import crypto from "node:crypto";
import { ensureRagTables, getRagPool } from "./rag.database.ts";
import type { RagIndexTaskRecord, RagIndexTaskStatus } from "./rag.types.ts";

type RagIndexTaskRow = {
  id: string;
  file_id: string;
  knowledge_base_id: string;
  status: RagIndexTaskStatus;
  error_message: string | null;
  chunk_count: string | number;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const toDateOrNull = (value: Date | string | null) => {
  return value ? new Date(value) : null;
};

const mapTaskRow = (row: RagIndexTaskRow): RagIndexTaskRecord => {
  return {
    id: row.id,
    fileId: row.file_id,
    knowledgeBaseId: row.knowledge_base_id,
    status: row.status,
    errorMessage: row.error_message,
    chunkCount: Number(row.chunk_count),
    startedAt: toDateOrNull(row.started_at),
    completedAt: toDateOrNull(row.completed_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
};

const truncateErrorMessage = (value: string) => {
  return value.length > 1000 ? `${value.slice(0, 997)}...` : value;
};

export class RagIndexTaskService {
  async createIndexingTask(fileId: string, knowledgeBaseId: string) {
    await ensureRagTables();

    const result = await getRagPool().query<RagIndexTaskRow>(
      `
        INSERT INTO rag_index_tasks (
          id,
          file_id,
          knowledge_base_id,
          status,
          error_message,
          chunk_count,
          started_at,
          completed_at
        )
        VALUES ($1, $2, $3, 'indexing', NULL, 0, NOW(), NULL)
        RETURNING *
      `,
      [crypto.randomUUID(), fileId, knowledgeBaseId]
    );

    return mapTaskRow(result.rows[0]);
  }

  async markReady(taskId: string, chunkCount: number) {
    await ensureRagTables();

    const result = await getRagPool().query<RagIndexTaskRow>(
      `
        UPDATE rag_index_tasks
        SET status = 'ready',
            error_message = NULL,
            chunk_count = $2,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [taskId, chunkCount]
    );

    return mapTaskRow(result.rows[0]);
  }

  async markFailed(taskId: string, errorMessage: string) {
    await ensureRagTables();

    const result = await getRagPool().query<RagIndexTaskRow>(
      `
        UPDATE rag_index_tasks
        SET status = 'failed',
            error_message = $2,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [taskId, truncateErrorMessage(errorMessage)]
    );

    return mapTaskRow(result.rows[0]);
  }

  async getLatestTaskForFile(fileId: string, knowledgeBaseId?: string) {
    await ensureRagTables();

    const result = await getRagPool().query<RagIndexTaskRow>(
      `
        SELECT *
        FROM rag_index_tasks
        WHERE file_id = $1
          AND ($2::uuid IS NULL OR knowledge_base_id = $2)
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [fileId, knowledgeBaseId ?? null]
    );

    return result.rows[0] ? mapTaskRow(result.rows[0]) : null;
  }
}

export const ragIndexTaskService = new RagIndexTaskService();

