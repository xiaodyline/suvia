import { buildUrl, request } from "./request";

export type UploadedFileStatus = "uploaded" | "indexing" | "ready" | "failed";

export type UploadedFile = {
  id: string;
  originalName: string;
  storedName: string;
  fileExt: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
  purpose: string;
  status: UploadedFileStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type UploadFileResponse = {
  file: UploadedFile;
};

type ListFilesResponse = {
  files: UploadedFile[];
};

type FileUrlResponse = {
  file: UploadedFile;
  url: string;
};

export const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", "rag");

  const response = await request("/api/files/upload", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json()) as UploadFileResponse;
  return data.file;
};

export const listFiles = async () => {
  const response = await request("/api/files");
  const data = (await response.json()) as ListFilesResponse;
  return data.files;
};

export const getFileUrl = async (fileId: string) => {
  const response = await request(`/api/files/${fileId}/url`);
  return (await response.json()) as FileUrlResponse;
};

export const getFileDownloadUrl = (fileId: string) => {
  return buildUrl(`/api/files/${fileId}/download`);
};
