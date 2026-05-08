import OSS from "ali-oss";
import crypto from "node:crypto";
import path from "node:path";
import type { Readable } from "node:stream";
import { getOssFileConfig, type OssFileConfig } from "./files.config.ts";
import type { ValidatedUploadFile } from "./files.types.ts";

export type OssFileUploadResult = {
  bucket: string;
  ossPath: string;
  storedName: string;
  url: string | null;
};

export class OssFileService {
  private client: OSS;
  private config: OssFileConfig;

  constructor(config = getOssFileConfig()) {
    this.config = config;
    this.client = new OSS({
      region: config.region,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });
  }

  async uploadFile(file: ValidatedUploadFile): Promise<OssFileUploadResult> {
    const { ossPath, storedName } = this.createOssPath(file.fileExt);

    const result = await this.client.put(ossPath, file.buffer, {
      headers: {
        "Content-Type": file.mimeType,
      },
    });

    return {
      bucket: this.config.bucket,
      ossPath,
      storedName,
      url: this.config.privateRead ? null : this.getPublicUrl(ossPath, result.url),
    };
  }

  async getFileStream(ossPath: string): Promise<Readable> {
    const result = await this.client.getStream(ossPath);
    return result.stream;
  }

  getAccessUrl(ossPath: string, fallbackUrl: string | null) {
    if (this.config.privateRead) {
      return this.client.signatureUrl(ossPath, {
        expires: this.config.signedUrlExpiresSeconds,
        method: "GET",
      });
    }

    return fallbackUrl || this.getPublicUrl(ossPath);
  }

  private createOssPath(fileExt: string) {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const storedName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

    return {
      storedName,
      ossPath: path.posix.join("uploads", "rag", year, month, storedName),
    };
  }

  private getPublicUrl(ossPath: string, fallbackUrl?: string) {
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${ossPath}`;
    }

    return fallbackUrl || ossPath;
  }
}

let defaultOssFileService: OssFileService | undefined;

export const getOssFileService = () => {
  defaultOssFileService ??= new OssFileService();
  return defaultOssFileService;
};
