import path from "node:path";
import {
  getFilesConfig,
  SUPPORTED_FILE_EXTENSIONS,
} from "./files.config.ts";
import type {
  IncomingUploadedFile,
  ValidatedUploadFile,
} from "./files.types.ts";

export class FileValidationError extends Error {
  status = 400;
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "FileValidationError";
    this.code = code;
  }
}

export const normalizeOriginalName = (originalName: string) => {
  const withoutPath = originalName.split(/[\\/]/).pop() || originalName;
  const cleaned = withoutPath.replace(/\0/g, "").trim();
  return cleaned || "uploaded-file";
};

const getFileExtension = (filename: string) => {
  return path.extname(filename).replace(/^\./, "").toLowerCase();
};

const isSupportedExtension = (extension: string) => {
  return SUPPORTED_FILE_EXTENSIONS.has(extension);
};

export const validateUploadedFile = (
  file: IncomingUploadedFile | undefined
): ValidatedUploadFile => {
  const config = getFilesConfig();

  if (!file) {
    throw new FileValidationError("No file was uploaded.", "FILE_REQUIRED");
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new FileValidationError("Uploaded file is empty.", "FILE_EMPTY");
  }

  if (file.size > config.maxSizeBytes) {
    throw new FileValidationError(
      `File size exceeds ${config.maxSizeMb}MB.`,
      "FILE_TOO_LARGE"
    );
  }

  const originalName = normalizeOriginalName(file.originalname);
  const fileExt = getFileExtension(originalName);

  if (!fileExt || !isSupportedExtension(fileExt)) {
    throw new FileValidationError(
      "Only PDF, MD, and Markdown files are allowed.",
      "FILE_TYPE_NOT_ALLOWED"
    );
  }

  if (!config.allowedExtensions.has(fileExt)) {
    throw new FileValidationError(
      "This file extension is disabled by server configuration.",
      "FILE_EXTENSION_DISABLED"
    );
  }

  return {
    originalName,
    fileExt,
    mimeType: file.mimetype || "application/octet-stream",
    sizeBytes: file.size,
    buffer: file.buffer,
  };
};

export const normalizePurpose = (value: unknown) => {
  const config = getFilesConfig();

  if (typeof value !== "string") {
    return config.defaultPurpose;
  }

  const purpose = value.trim().toLowerCase();

  if (!purpose) {
    return config.defaultPurpose;
  }

  return purpose.replace(/[^a-z0-9_-]/g, "").slice(0, 64) || config.defaultPurpose;
};

export const validateFileId = (fileId: string | undefined) => {
  if (
    !fileId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      fileId
    )
  ) {
    throw new FileValidationError("Invalid file id.", "INVALID_FILE_ID");
  }

  return fileId;
};
