import { request } from "./request";

export type RagIndexTaskStatus = "indexing" | "ready" | "failed";

export type RagIndexTask = {
  id: string;
  fileId: string;
  knowledgeBaseId: string;
  status: RagIndexTaskStatus;
  errorMessage: string | null;
  chunkCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RagIndexResponse = {
  task: RagIndexTask;
};

export type RagStatusResponse = {
  task: RagIndexTask | null;
};

export type RagQueryMatch = {
  id: string;
  fileId: string;
  fileName: string | null;
  knowledgeBaseId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  metadata: Record<string, unknown>;
  sectionTitle: string | null;
  page: number | null;
  tokenCount: number;
  similarity: number;
  createdAt: string;
};

export type RagQueryResponse = {
  matches: RagQueryMatch[];
};

export type RagQueryParams = {
  query: string;
  topK: number;
  fileIds?: string[];
  knowledgeBaseId?: string;
};

export const startRagIndex = async (fileId: string) => {
  const response = await request(`/api/rag/files/${fileId}/index`, {
    method: "POST",
  });

  return (await response.json()) as RagIndexResponse;
};

export const getRagFileStatus = async (fileId: string) => {
  const response = await request(`/api/rag/files/${fileId}/status`);
  return (await response.json()) as RagStatusResponse;
};

export const queryRag = async (params: RagQueryParams) => {
  const response = await request("/api/rag/query", {
    method: "POST",
    body: params,
  });

  return (await response.json()) as RagQueryResponse;
};

