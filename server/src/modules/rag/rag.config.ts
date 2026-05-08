import "../../config/env.ts";

export type EmbeddingProvider = "openai";
export type VectorStoreProvider = "postgres";

export type RagConfig = {
  enabled: boolean;
  defaultKnowledgeBaseName: string;
  topK: number;
  scoreThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
  queryMaxLength: number;
  topKMax: number;
};

export type EmbeddingConfig = {
  provider: EmbeddingProvider;
  apiUrl: string;
  apiKey: string;
  model: string;
  batchSize: number;
  dimensions: 1536;
};

export type VectorStoreConfig = {
  provider: VectorStoreProvider;
  pgvectorEnabled: boolean;
};

const DEFAULT_RAG_ENABLED = true;
const DEFAULT_KNOWLEDGE_BASE_NAME = "default";
const DEFAULT_TOP_K = 5;
const DEFAULT_SCORE_THRESHOLD = 0.2;
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 150;
const DEFAULT_QUERY_MAX_LENGTH = 1000;
const DEFAULT_TOP_K_MAX = 20;
const DEFAULT_EMBEDDING_API_URL = "https://api.openai.com/v1";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_EMBEDDING_BATCH_SIZE = 32;
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_VECTOR_STORE_PROVIDER = "postgres";

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return defaultValue;
  }
};

const parsePositiveInteger = (
  value: string | undefined,
  defaultValue: number
) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
};

const parseNumberInRange = (
  value: string | undefined,
  defaultValue: number,
  min: number,
  max: number
) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : defaultValue;
};

const parseProvider = <T extends string>(
  value: string | undefined,
  supported: Set<T>,
  defaultValue: T,
  envName: string
) => {
  const provider = (value?.trim().toLowerCase() || defaultValue) as T;

  if (!supported.has(provider)) {
    throw new Error(
      `${envName} must be ${Array.from(supported).join(", ")} for this RAG phase.`
    );
  }

  return provider;
};

export const getRagConfig = (): RagConfig => {
  const topKMax = parsePositiveInteger(process.env.RAG_TOP_K_MAX, DEFAULT_TOP_K_MAX);
  const chunkSize = parsePositiveInteger(
    process.env.RAG_CHUNK_SIZE,
    DEFAULT_CHUNK_SIZE
  );
  const chunkOverlap = Math.min(
    parsePositiveInteger(process.env.RAG_CHUNK_OVERLAP, DEFAULT_CHUNK_OVERLAP),
    Math.max(0, chunkSize - 1)
  );

  return {
    enabled: parseBoolean(process.env.RAG_ENABLED, DEFAULT_RAG_ENABLED),
    defaultKnowledgeBaseName:
      process.env.RAG_DEFAULT_KNOWLEDGE_BASE_NAME?.trim() ||
      DEFAULT_KNOWLEDGE_BASE_NAME,
    topK: Math.min(
      parsePositiveInteger(process.env.RAG_TOP_K, DEFAULT_TOP_K),
      topKMax
    ),
    scoreThreshold: parseNumberInRange(
      process.env.RAG_SCORE_THRESHOLD,
      DEFAULT_SCORE_THRESHOLD,
      0,
      1
    ),
    chunkSize,
    chunkOverlap,
    queryMaxLength: parsePositiveInteger(
      process.env.RAG_QUERY_MAX_LENGTH,
      DEFAULT_QUERY_MAX_LENGTH
    ),
    topKMax,
  };
};

export const getEmbeddingConfig = (): EmbeddingConfig => {
  const dimensions = parsePositiveInteger(
    process.env.EMBEDDING_DIMENSIONS,
    DEFAULT_EMBEDDING_DIMENSIONS
  );

  if (dimensions !== DEFAULT_EMBEDDING_DIMENSIONS) {
    throw new Error("EMBEDDING_DIMENSIONS must be 1536 for rag_chunks.vector(1536).");
  }

  return {
    provider: parseProvider(
      process.env.EMBEDDING_PROVIDER,
      new Set<EmbeddingProvider>(["openai"]),
      "openai",
      "EMBEDDING_PROVIDER"
    ),
    apiUrl:
      process.env.EMBEDDING_API_URL?.trim().replace(/\/$/, "") ||
      DEFAULT_EMBEDDING_API_URL,
    apiKey: process.env.EMBEDDING_API_KEY?.trim() || "",
    model: process.env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
    batchSize: parsePositiveInteger(
      process.env.EMBEDDING_BATCH_SIZE,
      DEFAULT_EMBEDDING_BATCH_SIZE
    ),
    dimensions,
  };
};

export const getVectorStoreConfig = (): VectorStoreConfig => {
  return {
    provider: parseProvider(
      process.env.VECTOR_STORE_PROVIDER,
      new Set<VectorStoreProvider>(["postgres"]),
      DEFAULT_VECTOR_STORE_PROVIDER,
      "VECTOR_STORE_PROVIDER"
    ),
    pgvectorEnabled: parseBoolean(process.env.PGVECTOR_ENABLED, true),
  };
};

