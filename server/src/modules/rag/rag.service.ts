import type { Readable } from "node:stream";
import { FileNotFoundError, filesService } from "../files/files.service.ts";
import { logger } from "../../utils/logger.ts";
import { DocumentParseError, documentParserService } from "./document-parser.service.ts";
import { documentSplitterService } from "./document-splitter.service.ts";
import { EmbeddingError, embeddingService } from "./embedding.service.ts";
import { pgVectorStoreService } from "./pg-vector-store.service.ts";
import { getEmbeddingConfig, getRagConfig } from "./rag.config.ts";
import { ragIndexTaskService } from "./rag-index-task.service.ts";
import type {
  DocumentChunk,
  ParsedDocument,
  RagIndexResult,
  RagQueryInput,
  RagQueryMatch,
  RagQueryResult,
  RagStatusResult,
} from "./rag.types.ts";

export class RagServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "RagServiceError";
    this.code = code;
    this.status = status;
  }
}

const streamToBuffer = async (stream: Readable) => {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

const getSafeErrorMessage = (error: unknown) => {
  if (
    error instanceof DocumentParseError ||
    error instanceof EmbeddingError ||
    error instanceof RagServiceError
  ) {
    return error.message;
  }

  return error instanceof Error ? error.message : "RAG indexing failed.";
};

const getDurationMs = (startedAt: number) => Date.now() - startedAt;

const getParsedTextLength = (document: ParsedDocument) => {
  return document.pages.reduce((total, page) => total + page.text.length, 0);
};

const getSearchResultSummary = (matches: RagQueryMatch[]) => {
  const fileIds = Array.from(new Set(matches.map((match) => match.fileId)));
  const topScore = matches[0]?.similarity;

  return {
    resultCount: matches.length,
    fileIds: fileIds.length > 0 ? fileIds.join(",") : undefined,
    topScore: topScore === undefined ? undefined : Number(topScore.toFixed(4)),
  };
};

export class RagService {
  async initialize() {
    if (!getRagConfig().enabled) {
      logger.info("RAG", "RAG is disabled");
      return;
    }

    await filesService.ensureTable();
    await pgVectorStoreService.getDefaultKnowledgeBase();
    logger.info("RAG", "RAG database initialized");
  }

  async startIndex(fileId: string): Promise<RagIndexResult> {
    this.assertEnabled();

    const knowledgeBase = await pgVectorStoreService.getDefaultKnowledgeBase();
    logger.info("RAG", "RAG indexing request received", {
      fileId,
      knowledgeBaseId: knowledgeBase.id,
    });

    try {
      await filesService.getFileRecord(fileId);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        logger.warn("RAG", "File metadata not found", { fileId });
      }

      throw error;
    }

    const task = await ragIndexTaskService.createIndexingTask(
      fileId,
      knowledgeBase.id
    );

    logger.info("RAG", "RAG indexing task created", {
      fileId,
      taskId: task.id,
      status: "running",
    });
    logger.info("RAG", "Updating file status", {
      fileId,
      status: "indexing",
    });
    await filesService.updateFileStatus(fileId, "indexing");

    void this.runIndexTask(fileId, task.id, knowledgeBase.id).catch((error) => {
      logger.error("RAG", "RAG indexing task crashed", error, {
        fileId,
        taskId: task.id,
      });
    });

    return { task };
  }

  async getFileStatus(fileId: string): Promise<RagStatusResult> {
    try {
      this.assertEnabled();

      await filesService.getFileRecord(fileId);
      const knowledgeBase = await pgVectorStoreService.getDefaultKnowledgeBase();
      const task = await ragIndexTaskService.getLatestTaskForFile(
        fileId,
        knowledgeBase.id
      );

      logger.info("RAG", "RAG status loaded", {
        fileId,
        status: task?.status ?? "none",
        taskId: task?.id,
        chunkCount: task?.chunkCount,
      });

      return { task };
    } catch (error) {
      logger.error("RAG", "RAG status load failed", error, { fileId });
      throw error;
    }
  }

  async query(input: RagQueryInput): Promise<RagQueryResult> {
    const startedAt = Date.now();
    let knowledgeBaseId = input.knowledgeBaseId;

    try {
      this.assertEnabled();

      knowledgeBaseId ??= (await pgVectorStoreService.getDefaultKnowledgeBase()).id;
      const effectiveInput = {
        ...input,
        knowledgeBaseId,
      };
      const queryLength = input.query.length;
      const embeddingConfig = getEmbeddingConfig();

      logger.info("RAG", "RAG query received", {
        knowledgeBaseId,
        topK: input.topK,
        queryLength,
      });

      const embeddingStartedAt = Date.now();
      logger.info("RAG", "Query embedding started", {
        queryLength,
        provider: embeddingConfig.provider,
        model: embeddingConfig.model,
      });

      let embedding: number[];

      try {
        embedding = await embeddingService.embedQuery(input.query);
        logger.info("RAG", "Query embedding completed", {
          queryLength,
          durationMs: getDurationMs(embeddingStartedAt),
        });
      } catch (error) {
        logger.error("RAG", "Query embedding failed", error, { queryLength });
        throw error;
      }

      const searchStartedAt = Date.now();
      logger.info("RAG", "Vector search started", {
        knowledgeBaseId,
        topK: input.topK,
        store: "pgvector",
      });

      const matches = await pgVectorStoreService
        .search(effectiveInput, embedding)
        .catch((error) => {
          logger.error("RAG", "Vector search failed", error, {
            knowledgeBaseId,
            topK: input.topK,
          });
          throw error;
        });
      const resultSummary = getSearchResultSummary(matches);

      logger.info("RAG", "Vector search completed", {
        knowledgeBaseId,
        topK: input.topK,
        resultCount: matches.length,
        durationMs: getDurationMs(searchStartedAt),
      });
      logger.info("RAG", "Vector search result summary", resultSummary);
      logger.info("RAG", "RAG query completed", {
        knowledgeBaseId,
        topK: input.topK,
        resultCount: matches.length,
        durationMs: getDurationMs(startedAt),
      });

      return { matches };
    } catch (error) {
      logger.error("RAG", "RAG query failed", error, {
        knowledgeBaseId,
        topK: input.topK,
        durationMs: getDurationMs(startedAt),
      });
      throw error;
    }
  }

  private async runIndexTask(
    fileId: string,
    taskId: string,
    knowledgeBaseId: string
  ) {
    const startedAt = Date.now();

    logger.info("RAG", "RAG indexing started", {
      fileId,
      taskId,
    });

    try {
      await pgVectorStoreService.deleteChunksForFile(fileId, knowledgeBaseId);

      logger.info("RAG", "Loading file metadata", { fileId });

      const record = await filesService.getFileRecord(fileId).catch((error) => {
        if (error instanceof FileNotFoundError) {
          logger.warn("RAG", "File metadata not found", { fileId });
        }

        throw error;
      });

      logger.info("RAG", "File metadata loaded", {
        fileId,
        originalName: record.originalName,
        fileExt: record.fileExt,
        sizeBytes: record.sizeBytes,
        status: record.status,
      });

      const loadStartedAt = Date.now();
      logger.info("RAG", "Loading file from OSS", {
        fileId,
        ossPath: record.ossPath,
      });

      let buffer: Buffer;

      try {
        const stream = await filesService.getOssFileStream(record.ossPath);
        buffer = await streamToBuffer(stream);
        logger.info("RAG", "File loaded from OSS", {
          fileId,
          sizeBytes: buffer.length,
          durationMs: getDurationMs(loadStartedAt),
        });
      } catch (error) {
        logger.error("RAG", "Load file from OSS failed", error, { fileId });
        throw error;
      }

      const parseStartedAt = Date.now();
      logger.info("RAG", "Document parsing started", {
        fileId,
        fileExt: record.fileExt,
      });

      const parsedDocument = await documentParserService
        .parse(record, buffer)
        .catch((error) => {
          logger.error("RAG", "Document parsing failed", error, { fileId });
          throw error;
        });
      const textLength = getParsedTextLength(parsedDocument);

      logger.info("RAG", "Document parsed", {
        fileId,
        textLength,
        durationMs: getDurationMs(parseStartedAt),
      });

      const splitStartedAt = Date.now();
      logger.info("RAG", "Chunk splitting started", {
        fileId,
        textLength,
      });

      let chunks: DocumentChunk[];

      try {
        chunks = documentSplitterService.split(parsedDocument);
        logger.info("RAG", "Chunk splitting completed", {
          fileId,
          chunkCount: chunks.length,
          durationMs: getDurationMs(splitStartedAt),
        });
      } catch (error) {
        logger.error("RAG", "Chunk splitting failed", error, { fileId });
        throw error;
      }

      if (chunks.length === 0) {
        throw new RagServiceError(
          "Document produced no chunks after splitting.",
          "RAG_EMPTY_CHUNKS"
        );
      }

      const embeddingConfig = getEmbeddingConfig();
      const embeddingStartedAt = Date.now();
      logger.info("RAG", "Embedding generation started", {
        fileId,
        chunkCount: chunks.length,
        provider: embeddingConfig.provider,
        model: embeddingConfig.model,
      });

      const embeddings = await embeddingService
        .embedDocuments(chunks.map((chunk) => chunk.content))
        .catch((error) => {
          logger.error("RAG", "Embedding generation failed", error, { fileId });
          throw error;
        });

      logger.info("RAG", "Embedding generation completed", {
        fileId,
        chunkCount: chunks.length,
        durationMs: getDurationMs(embeddingStartedAt),
      });

      const insertStartedAt = Date.now();
      logger.info("RAG", "Vector insert started", {
        fileId,
        taskId,
        chunkCount: chunks.length,
        store: "pgvector",
      });

      await pgVectorStoreService
        .insertChunks(fileId, knowledgeBaseId, chunks, embeddings)
        .catch((error) => {
          logger.error("RAG", "Vector insert failed", error, { fileId, taskId });
          throw error;
        });

      logger.info("RAG", "Vector insert completed", {
        fileId,
        taskId,
        chunkCount: chunks.length,
        durationMs: getDurationMs(insertStartedAt),
      });

      logger.info("RAG", "Updating index task status", {
        taskId,
        status: "ready",
        chunkCount: chunks.length,
      });
      await ragIndexTaskService.markReady(taskId, chunks.length);
      logger.info("RAG", "Updating file status", {
        fileId,
        status: "ready",
      });
      await filesService.updateFileStatus(fileId, "ready");
      logger.info("RAG", "RAG indexing completed", {
        fileId,
        taskId,
        chunkCount: chunks.length,
        durationMs: getDurationMs(startedAt),
      });
    } catch (error) {
      const message = getSafeErrorMessage(error);

      try {
        logger.info("RAG", "Updating index task status", {
          taskId,
          status: "failed",
          error: message,
        });
        await ragIndexTaskService.markFailed(taskId, message);
        logger.info("RAG", "Updating file status", {
          fileId,
          status: "failed",
        });
        await filesService.updateFileStatus(fileId, "failed", message);
      } finally {
        logger.error("RAG", "RAG indexing failed", {
          fileId,
          taskId,
          error: message,
          durationMs: getDurationMs(startedAt),
        });
      }
    }
  }

  private assertEnabled() {
    if (!getRagConfig().enabled) {
      throw new RagServiceError("RAG is disabled.", "RAG_DISABLED", 503);
    }
  }
}

export const ragService = new RagService();
