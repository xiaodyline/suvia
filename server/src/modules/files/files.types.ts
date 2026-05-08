import type { Readable } from "node:stream";

export type UploadedFileStatus = "uploaded" | "failed";

export type UploadedFileRecord = {
  id: string;
  originalName: string;
  storedName: string;
  fileExt: string;
  mimeType: string;
  sizeBytes: number;
  ossBucket: string;
  ossPath: string;
  url: string | null;
  purpose: string;
  status: UploadedFileStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UploadedFileRow = {
  id: string;
  original_name: string;
  stored_name: string;
  file_ext: string;
  mime_type: string;
  size_bytes: string | number;
  oss_bucket: string;
  oss_path: string;
  url: string | null;
  purpose: string;
  status: UploadedFileStatus;
  error_message: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ApiFileRecord = Omit<UploadedFileRecord, "ossBucket" | "ossPath">;

export type IncomingUploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type ValidatedUploadFile = {
  originalName: string;
  fileExt: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

export type UploadFileResult = {
  record: UploadedFileRecord;
};

export type FileDownloadResult = {
  record: UploadedFileRecord;
  stream: Readable;
};
