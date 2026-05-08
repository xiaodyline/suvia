export class DocumentCleanerService {
  cleanText(value: string) {
    return value
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  hasExtractableText(value: string) {
    return this.cleanText(value).replace(/\s/g, "").length > 0;
  }
}

export const documentCleanerService = new DocumentCleanerService();

