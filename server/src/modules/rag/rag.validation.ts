import { getRagConfig } from "./rag.config.ts";
import type { RagQueryInput } from "./rag.types.ts";

export class RagValidationError extends Error {
  status = 400;
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "RagValidationError";
    this.code = code;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const validateUuid = (
  value: unknown,
  fieldName: string,
  code = "INVALID_UUID"
) => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new RagValidationError(`Invalid ${fieldName}.`, code);
  }

  return value;
};

export const validateFileIdParam = (fileId: unknown) => {
  return validateUuid(fileId, "fileId", "INVALID_FILE_ID");
};

const normalizeTopK = (value: unknown) => {
  const config = getRagConfig();

  if (value === undefined || value === null || value === "") {
    return config.topK;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new RagValidationError("topK must be a positive integer.", "INVALID_TOP_K");
  }

  return Math.min(parsed, config.topKMax);
};

const normalizeScoreThreshold = (value: unknown) => {
  const config = getRagConfig();

  if (value === undefined || value === null || value === "") {
    return config.scoreThreshold;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new RagValidationError(
      "scoreThreshold must be between 0 and 1.",
      "INVALID_SCORE_THRESHOLD"
    );
  }

  return parsed;
};

export const validateRagQueryBody = (body: unknown): RagQueryInput => {
  const config = getRagConfig();
  const payload = body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};
  const query = typeof payload.query === "string" ? payload.query.trim() : "";

  if (!query) {
    throw new RagValidationError("query is required.", "QUERY_REQUIRED");
  }

  if (query.length > config.queryMaxLength) {
    throw new RagValidationError(
      `query must be at most ${config.queryMaxLength} characters.`,
      "QUERY_TOO_LONG"
    );
  }

  const knowledgeBaseId = payload.knowledgeBaseId === undefined
    ? undefined
    : validateUuid(payload.knowledgeBaseId, "knowledgeBaseId", "INVALID_KNOWLEDGE_BASE_ID");

  const fileIds = payload.fileIds === undefined
    ? undefined
    : normalizeFileIds(payload.fileIds);

  return {
    query,
    topK: normalizeTopK(payload.topK),
    knowledgeBaseId,
    fileIds,
    scoreThreshold: normalizeScoreThreshold(payload.scoreThreshold),
  };
};

const normalizeFileIds = (value: unknown) => {
  if (!Array.isArray(value)) {
    throw new RagValidationError("fileIds must be an array.", "INVALID_FILE_IDS");
  }

  return value.map((fileId) =>
    validateUuid(fileId, "fileIds", "INVALID_FILE_IDS")
  );
};

