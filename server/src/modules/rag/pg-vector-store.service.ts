import crypto from "node:crypto";
import { getRagConfig, getVectorStoreConfig } from "./rag.config.ts";
import { ensureRagTables, getRagPool } from "./rag.database.ts";
import type {
  DocumentChunk,
  KnowledgeBaseRecord,
  RagQueryInput,
  RagQueryMatch,
} from "./rag.types.ts";

type KnowledgeBaseRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type RagChunkSearchRow = {
  id: string;
  file_id: string;
  file_name: string | null;
  knowledge_base_id: string;
  chunk_index: number;
  content: string;
  content_hash: string;
  metadata: Record<string, unknown>;
  section_title: string | null;
  page: number | null;
  token_count: number;
  similarity: string | number;
  created_at: Date | string;
};

const mapKnowledgeBaseRow = (row: KnowledgeBaseRow): KnowledgeBaseRecord => {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
};

const mapSearchRow = (row: RagChunkSearchRow): RagQueryMatch => {
  return {
    id: row.id,
    fileId: row.file_id,
    fileName: row.file_name,
    knowledgeBaseId: row.knowledge_base_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    contentHash: row.content_hash,
    metadata: row.metadata,
    sectionTitle: row.section_title,
    page: row.page,
    tokenCount: row.token_count,
    similarity: Number(row.similarity),
    createdAt: new Date(row.created_at),
  };
};

const vectorToSql = (embedding: number[]) => {
  if (!embedding.every((value) => Number.isFinite(value))) {
    throw new Error("Embedding contains non-finite numbers.");
  }

  return `[${embedding.join(",")}]`;
};

export class PgVectorStoreService {
  async ensureReady() {
    const config = getVectorStoreConfig();

    if (!config.pgvectorEnabled) {
      throw new Error("PGVECTOR_ENABLED must be true for the PostgreSQL vector store.");
    }

    await ensureRagTables();
  }

  async getDefaultKnowledgeBase() {
    await this.ensureReady();

    const config = getRagConfig();
    const result = await getRagPool().query<KnowledgeBaseRow>(
      `
        INSERT INTO knowledge_bases (id, name, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (name)
        DO UPDATE SET updated_at = knowledge_bases.updated_at
        RETURNING *
      `,
      [crypto.randomUUID(), config.defaultKnowledgeBaseName, "Default RAG knowledge base"]
    );

    return mapKnowledgeBaseRow(result.rows[0]);
  }

  async deleteChunksForFile(fileId: string, knowledgeBaseId: string) {
    await this.ensureReady();

    await getRagPool().query(
      "DELETE FROM rag_chunks WHERE file_id = $1 AND knowledge_base_id = $2",
      [fileId, knowledgeBaseId]
    );
  }

  async insertChunks(
    fileId: string,
    knowledgeBaseId: string,
    chunks: DocumentChunk[],
    embeddings: number[][]
  ) {
    await this.ensureReady();

    if (chunks.length !== embeddings.length) {
      throw new Error("Chunk count does not match embedding count.");
    }

    const client = await getRagPool().connect();

    try {
      await client.query("BEGIN");

      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const embedding = embeddings[index];

        await client.query(
          `
            INSERT INTO rag_chunks (
              id,
              file_id,
              knowledge_base_id,
              chunk_index,
              content,
              content_hash,
              embedding,
              metadata,
              section_title,
              page,
              token_count
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7::vector,
              $8::jsonb,
              $9,
              $10,
              $11
            )
          `,
          [
            crypto.randomUUID(),
            fileId,
            knowledgeBaseId,
            chunk.chunkIndex,
            chunk.content,
            chunk.contentHash,
            vectorToSql(embedding),
            JSON.stringify(chunk.metadata),
            chunk.sectionTitle,
            chunk.page,
            chunk.tokenCount,
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async search(input: RagQueryInput, queryEmbedding: number[]) {
    await this.ensureReady();

    const knowledgeBaseId =
      input.knowledgeBaseId ?? (await this.getDefaultKnowledgeBase()).id;
    const fileIds = input.fileIds && input.fileIds.length > 0 ? input.fileIds : null;
    const result = await getRagPool().query<RagChunkSearchRow>(
      `
        SELECT
          c.id,
          c.file_id,
          f.original_name AS file_name,
          c.knowledge_base_id,
          c.chunk_index,
          c.content,
          c.content_hash,
          c.metadata,
          c.section_title,
          c.page,
          c.token_count,
          1 - (c.embedding <=> $1::vector) AS similarity,
          c.created_at
        FROM rag_chunks c
        LEFT JOIN uploaded_files f ON f.id = c.file_id
        WHERE c.knowledge_base_id = $2
          AND ($3::uuid[] IS NULL OR c.file_id = ANY($3::uuid[]))
          AND 1 - (c.embedding <=> $1::vector) >= $4
        ORDER BY c.embedding <=> $1::vector
        LIMIT $5
      `,
      [
        vectorToSql(queryEmbedding),
        knowledgeBaseId,
        fileIds,
        input.scoreThreshold,
        input.topK,
      ]
    );

    return result.rows.map(mapSearchRow);
  }
}

export const pgVectorStoreService = new PgVectorStoreService();

