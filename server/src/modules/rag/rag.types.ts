export type RagFileExtension = "pdf" | "md" | "markdown";

export type RagIndexTaskStatus = "indexing" | "ready" | "failed";

export type KnowledgeBaseRecord = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RagIndexTaskRecord = {
  id: string;
  fileId: string;
  knowledgeBaseId: string;
  status: RagIndexTaskStatus;
  errorMessage: string | null;
  chunkCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ParsedDocumentPage = {
  page: number | null;
  text: string;
};

export type ParsedDocument = {
  fileId: string;
  fileName: string;
  fileExt: RagFileExtension;
  pages: ParsedDocumentPage[];
};

export type DocumentChunk = {
  chunkIndex: number;
  content: string;
  contentHash: string;
  sectionTitle: string | null;
  page: number | null;
  tokenCount: number;
  metadata: Record<string, unknown>;
};

export type RagChunkRecord = DocumentChunk & {
  id: string;
  fileId: string;
  knowledgeBaseId: string;
  createdAt: Date;
};

export type RagQueryInput = {
  query: string;
  topK: number;
  knowledgeBaseId?: string;
  fileIds?: string[];
  scoreThreshold: number;
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
  createdAt: Date;
};

export type RagIndexResult = {
  task: RagIndexTaskRecord;
};

export type RagStatusResult = {
  task: RagIndexTaskRecord | null;
};

export type RagQueryResult = {
  matches: RagQueryMatch[];
};

