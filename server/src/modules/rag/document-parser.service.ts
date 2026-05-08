import { PDFParse } from "pdf-parse";
import type { UploadedFileRecord } from "../files/files.types.ts";
import { documentCleanerService, type DocumentCleanerService } from "./document-cleaner.service.ts";
import type { ParsedDocument, ParsedDocumentPage, RagFileExtension } from "./rag.types.ts";

export class DocumentParseError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "DocumentParseError";
    this.code = code;
  }
}

const RAG_FILE_EXTENSIONS = new Set<RagFileExtension>(["pdf", "md", "markdown"]);

const toRagFileExtension = (fileExt: string): RagFileExtension => {
  const normalized = fileExt.toLowerCase() as RagFileExtension;

  if (!RAG_FILE_EXTENSIONS.has(normalized)) {
    throw new DocumentParseError(
      "Only PDF, MD, and Markdown files are supported for RAG indexing.",
      "RAG_FILE_TYPE_NOT_SUPPORTED"
    );
  }

  return normalized;
};

const normalizePdfPages = (pages: Array<{ num: number; text: string }>) => {
  return pages.map<ParsedDocumentPage>((page) => ({
    page: page.num,
    text: documentCleanerService.cleanText(page.text),
  }));
};

export class DocumentParserService {
  constructor(private readonly cleaner: DocumentCleanerService = documentCleanerService) {}

  async parse(file: UploadedFileRecord, buffer: Buffer): Promise<ParsedDocument> {
    const fileExt = toRagFileExtension(file.fileExt);

    if (fileExt === "pdf") {
      return this.parsePdf(file, buffer, fileExt);
    }

    return this.parseMarkdown(file, buffer, fileExt);
  }

  private parseMarkdown(
    file: UploadedFileRecord,
    buffer: Buffer,
    fileExt: RagFileExtension
  ): ParsedDocument {
    const text = this.cleaner.cleanText(buffer.toString("utf8"));

    if (!this.cleaner.hasExtractableText(text)) {
      throw new DocumentParseError("Markdown file has no extractable text.", "EMPTY_DOCUMENT");
    }

    return {
      fileId: file.id,
      fileName: file.originalName,
      fileExt,
      pages: [
        {
          page: null,
          text,
        },
      ],
    };
  }

  private async parsePdf(
    file: UploadedFileRecord,
    buffer: Buffer,
    fileExt: RagFileExtension
  ): Promise<ParsedDocument> {
    const parser = new PDFParse({
      data: new Uint8Array(buffer),
      disableFontFace: true,
    });

    try {
      const result = await parser.getText({
        pageJoiner: "",
        parseHyperlinks: false,
      });
      const pages = normalizePdfPages(result.pages).filter((page) =>
        this.cleaner.hasExtractableText(page.text)
      );

      if (pages.length === 0) {
        throw new DocumentParseError(
          "PDF has no extractable text. Scanned PDFs require OCR and are not supported in this phase.",
          "PDF_TEXT_NOT_EXTRACTABLE"
        );
      }

      return {
        fileId: file.id,
        fileName: file.originalName,
        fileExt,
        pages,
      };
    } finally {
      await parser.destroy();
    }
  }
}

export const documentParserService = new DocumentParserService();

