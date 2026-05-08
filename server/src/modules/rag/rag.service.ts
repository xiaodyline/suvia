import type { Readable } from "node:stream";
import { filesService } from "../files/files.service.ts";
import { logger } from "../../utils/logger.ts";
import { DocumentParseError, documentParserService } from "./document-parser.service.ts";
import { documentSplitterService } from "./document-splitter.service.ts";
import { EmbeddingError, embeddingService } from "./embedding.service.ts";
import { pgVectorStoreService } from "./pg-vector-store.service.ts";
import { getRagConfig } from "./rag.config.ts";
import { ragIndexTaskService } from "./rag-index-task.service.ts";
import type {
  RagIndexResult,
  RagQueryInput,
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

    await filesService.getFileRecord(fileId);
    const knowledgeBase = await pgVectorStoreService.getDefaultKnowledgeBase();
    const task = await ragIndexTaskService.createIndexingTask(
      fileId,
      knowledgeBase.id
    );

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
    this.assertEnabled();

    await filesService.getFileRecord(fileId);
    const knowledgeBase = await pgVectorStoreService.getDefaultKnowledgeBase();
    const task = await ragIndexTaskService.getLatestTaskForFile(
      fileId,
      knowledgeBase.id
    );

    return { task };
  }

  async query(input: RagQueryInput): Promise<RagQueryResult> {
    this.assertEnabled();

    const embedding = await embeddingService.embedQuery(input.query);
    const matches = await pgVectorStoreService.search(input, embedding);

    return { matches };
  }

  private async runIndexTask(
    fileId: string,
    taskId: string,
    knowledgeBaseId: string
  ) {
    try {
      await pgVectorStoreService.deleteChunksForFile(fileId, knowledgeBaseId);

      const { record, stream } = await filesService.getDownloadStream(fileId);
      const buffer = await streamToBuffer(stream);
      const parsedDocument = await documentParserService.parse(record, buffer);
      const chunks = documentSplitterService.split(parsedDocument);

      if (chunks.length === 0) {
        throw new RagServiceError(
          "Document produced no chunks after splitting.",
          "RAG_EMPTY_CHUNKS"
        );
      }

      const embeddings = await embeddingService.embedDocuments(
        chunks.map((chunk) => chunk.content)
      );

      await pgVectorStoreService.insertChunks(
        fileId,
        knowledgeBaseId,
        chunks,
        embeddings
      );
      await ragIndexTaskService.markReady(taskId, chunks.length);
      await filesService.updateFileStatus(fileId, "ready");
    } catch (error) {
      const message = getSafeErrorMessage(error);

      await ragIndexTaskService.markFailed(taskId, message);
      await filesService.updateFileStatus(fileId, "failed", message);
      logger.warn("RAG", "RAG indexing failed", {
        fileId,
        taskId,
        error: message,
      });
    }
  }

  private assertEnabled() {
    if (!getRagConfig().enabled) {
      throw new RagServiceError("RAG is disabled.", "RAG_DISABLED", 503);
    }
  }
}

export const ragService = new RagService();

