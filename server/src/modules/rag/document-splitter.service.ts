import crypto from "node:crypto";
import { getRagConfig } from "./rag.config.ts";
import { documentCleanerService, type DocumentCleanerService } from "./document-cleaner.service.ts";
import type { DocumentChunk, ParsedDocument } from "./rag.types.ts";

type Segment = {
  text: string;
  sectionTitle: string | null;
};

type ChunkDraft = {
  content: string;
  sectionTitle: string | null;
  page: number | null;
};

const estimateTokenCount = (value: string) => {
  return Math.max(1, Math.ceil(value.length / 4));
};

const hashContent = (value: string) => {
  return crypto.createHash("sha256").update(value).digest("hex");
};

const detectMarkdownHeading = (value: string) => {
  const match = value.match(/^#{1,6}\s+(.+)$/);
  return match?.[1]?.trim() || null;
};

const splitOversizedText = (value: string, chunkSize: number) => {
  if (value.length <= chunkSize) {
    return [value];
  }

  const parts: string[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    parts.push(value.slice(cursor, cursor + chunkSize));
    cursor += chunkSize;
  }

  return parts;
};

const getOverlapText = (value: string, overlap: number) => {
  if (overlap <= 0 || value.length <= overlap) {
    return "";
  }

  return value.slice(-overlap).trimStart();
};

export class DocumentSplitterService {
  constructor(private readonly cleaner: DocumentCleanerService = documentCleanerService) {}

  split(document: ParsedDocument): DocumentChunk[] {
    const config = getRagConfig();
    const drafts: ChunkDraft[] = [];
    let currentSectionTitle: string | null = null;

    for (const page of document.pages) {
      const segments = this.createSegments(
        page.text,
        document.fileExt === "pdf" ? null : currentSectionTitle,
        config.chunkSize
      );

      currentSectionTitle = segments.at(-1)?.sectionTitle ?? currentSectionTitle;
      drafts.push(
        ...this.createPageChunks(
          segments,
          page.page,
          config.chunkSize,
          config.chunkOverlap
        )
      );
    }

    return drafts.map((draft, index) => ({
      chunkIndex: index,
      content: draft.content,
      contentHash: hashContent(draft.content),
      sectionTitle: draft.sectionTitle,
      page: draft.page,
      tokenCount: estimateTokenCount(draft.content),
      metadata: {
        fileName: document.fileName,
        fileExt: document.fileExt,
        source: "uploaded_file",
        charCount: draft.content.length,
      },
    }));
  }

  private createSegments(
    text: string,
    initialSectionTitle: string | null,
    chunkSize: number
  ) {
    const blocks = this.cleaner
      .cleanText(text)
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
    const segments: Segment[] = [];
    let sectionTitle = initialSectionTitle;

    for (const block of blocks) {
      const heading = detectMarkdownHeading(block);

      if (heading) {
        sectionTitle = heading;
      }

      for (const part of splitOversizedText(block, chunkSize)) {
        segments.push({
          text: part,
          sectionTitle,
        });
      }
    }

    return segments;
  }

  private createPageChunks(
    segments: Segment[],
    page: number | null,
    chunkSize: number,
    overlap: number
  ) {
    const chunks: ChunkDraft[] = [];
    let content = "";
    let sectionTitle: string | null = null;

    const flush = () => {
      const normalized = this.cleaner.cleanText(content);

      if (!normalized) {
        content = "";
        sectionTitle = null;
        return;
      }

      chunks.push({
        content: normalized,
        sectionTitle,
        page,
      });

      content = getOverlapText(normalized, overlap);
      sectionTitle = content ? sectionTitle : null;
    };

    for (const segment of segments) {
      const separator = content ? "\n\n" : "";
      const nextLength = content.length + separator.length + segment.text.length;

      if (content && nextLength > chunkSize) {
        flush();
      }

      if (!sectionTitle) {
        sectionTitle = segment.sectionTitle;
      }

      content = content ? `${content}\n\n${segment.text}` : segment.text;
    }

    flush();

    return chunks;
  }
}

export const documentSplitterService = new DocumentSplitterService();

