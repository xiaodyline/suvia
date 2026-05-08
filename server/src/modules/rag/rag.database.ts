import { Pool } from "pg";
import { resolvePostgresUrl } from "../../checkpoints/checkpointer.config.ts";

let pool: Pool | undefined;
let setupPromise: Promise<void> | undefined;

const getRagDatabaseUrl = () => {
  const postgresUrl = resolvePostgresUrl();

  if (!postgresUrl) {
    throw new Error("RAG requires CHECKPOINT_POSTGRES_URL or DATABASE_URL.");
  }

  return postgresUrl;
};

export const getRagPool = () => {
  pool ??= new Pool({
    connectionString: getRagDatabaseUrl(),
  });

  return pool;
};

export const ensureRagTables = async () => {
  setupPromise ??= getRagPool()
    .query(
      `
        CREATE EXTENSION IF NOT EXISTS vector;

        CREATE TABLE IF NOT EXISTS knowledge_bases (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS rag_index_tasks (
          id UUID PRIMARY KEY,
          file_id UUID NOT NULL,
          knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          error_message TEXT,
          chunk_count INTEGER NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS rag_chunks (
          id UUID PRIMARY KEY,
          file_id UUID NOT NULL,
          knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
          chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          embedding VECTOR(1536) NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          section_title TEXT,
          page INTEGER,
          token_count INTEGER NOT NULL DEFAULT 0 CHECK (token_count >= 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (file_id, knowledge_base_id, chunk_index)
        );

        CREATE INDEX IF NOT EXISTS idx_rag_index_tasks_file_id
          ON rag_index_tasks (file_id);

        CREATE INDEX IF NOT EXISTS idx_rag_index_tasks_knowledge_base_id
          ON rag_index_tasks (knowledge_base_id);

        CREATE INDEX IF NOT EXISTS idx_rag_index_tasks_created_at
          ON rag_index_tasks (created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_rag_chunks_file_id
          ON rag_chunks (file_id);

        CREATE INDEX IF NOT EXISTS idx_rag_chunks_knowledge_base_id
          ON rag_chunks (knowledge_base_id);

        CREATE INDEX IF NOT EXISTS idx_rag_chunks_metadata
          ON rag_chunks USING GIN (metadata);

        CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_cosine
          ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100);
      `
    )
    .then(() => undefined)
    .catch((error) => {
      setupPromise = undefined;
      throw error;
    });

  return setupPromise;
};

