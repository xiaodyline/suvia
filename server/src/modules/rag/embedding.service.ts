import { getEmbeddingConfig } from "./rag.config.ts";

export class EmbeddingError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "EmbeddingError";
    this.code = code;
  }
}

type OpenAiEmbeddingItem = {
  index: number;
  embedding: number[];
};

type OpenAiEmbeddingResponse = {
  data?: OpenAiEmbeddingItem[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

const assertEmbeddingVector = (value: unknown, dimensions: number) => {
  if (
    !Array.isArray(value) ||
    value.length !== dimensions ||
    !value.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    throw new EmbeddingError(
      `Embedding response must contain ${dimensions}-dimension numeric vectors.`,
      "INVALID_EMBEDDING_VECTOR"
    );
  }

  return value;
};

export class EmbeddingService {
  async embedQuery(query: string) {
    const [embedding] = await this.embedTexts([query]);
    return embedding;
  }

  async embedDocuments(documents: string[]) {
    return this.embedTexts(documents);
  }

  private async embedTexts(texts: string[]) {
    const config = getEmbeddingConfig();

    if (!config.apiKey) {
      throw new EmbeddingError(
        "EMBEDDING_API_KEY is required to generate RAG embeddings.",
        "EMBEDDING_API_KEY_MISSING"
      );
    }

    if (texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];

    for (let start = 0; start < texts.length; start += config.batchSize) {
      const batch = texts.slice(start, start + config.batchSize);
      embeddings.push(...(await this.requestOpenAiEmbeddings(batch)));
    }

    return embeddings;
  }

  private async requestOpenAiEmbeddings(texts: string[]) {
    const config = getEmbeddingConfig();
    const response = await fetch(`${config.apiUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: texts,
        dimensions: config.dimensions,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as OpenAiEmbeddingResponse;

    if (!response.ok) {
      throw new EmbeddingError(
        payload.error?.message || `Embedding request failed with ${response.status}.`,
        "EMBEDDING_REQUEST_FAILED"
      );
    }

    if (!payload.data) {
      throw new EmbeddingError(
        "Embedding response is missing data.",
        "EMBEDDING_RESPONSE_MISSING_DATA"
      );
    }

    return payload.data
      .slice()
      .sort((left, right) => left.index - right.index)
      .map((item) => assertEmbeddingVector(item.embedding, config.dimensions));
  }
}

export const embeddingService = new EmbeddingService();

