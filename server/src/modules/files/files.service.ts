import crypto from "node:crypto";
import { Pool } from "pg";
import { getFilesDatabaseUrl } from "./files.config.ts";
import {
  getOssFileService,
  type OssFileService,
} from "./oss-file.service.ts";
import {
  normalizePurpose,
  validateFileId,
  validateUploadedFile,
} from "./files.validation.ts";
import type {
  ApiFileRecord,
  FileDownloadResult,
  IncomingUploadedFile,
  UploadedFileRecord,
  UploadedFileRow,
} from "./files.types.ts";

class FileNotFoundError extends Error {
  status = 404;
  code = "FILE_NOT_FOUND";

  constructor(fileId: string) {
    super(`File not found: ${fileId}`);
    this.name = "FileNotFoundError";
  }
}

let pool: Pool | undefined;
let setupPromise: Promise<void> | undefined;

const getPool = () => {
  pool ??= new Pool({
    connectionString: getFilesDatabaseUrl(),
  });

  return pool;
};

const mapRowToRecord = (row: UploadedFileRow): UploadedFileRecord => {
  return {
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    fileExt: row.file_ext,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    ossBucket: row.oss_bucket,
    ossPath: row.oss_path,
    url: row.url,
    purpose: row.purpose,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
};

export const toApiFileRecord = (record: UploadedFileRecord): ApiFileRecord => {
  const { ossBucket: _ossBucket, ossPath: _ossPath, ...apiRecord } = record;
  return apiRecord;
};

export class FilesService {
  constructor(private readonly ossService?: OssFileService) {}

  private getOssService() {
    return this.ossService ?? getOssFileService();
  }

  async uploadFile(file: IncomingUploadedFile | undefined, purposeValue: unknown) {
    const validatedFile = validateUploadedFile(file);
    const purpose = normalizePurpose(purposeValue);

    await this.ensureTable();

    const ossResult = await this.getOssService().uploadFile(validatedFile);

    const result = await getPool().query<UploadedFileRow>(
      `
        INSERT INTO uploaded_files (
          id,
          original_name,
          stored_name,
          file_ext,
          mime_type,
          size_bytes,
          oss_bucket,
          oss_path,
          url,
          purpose,
          status,
          error_message
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          'uploaded',
          NULL
        )
        RETURNING *
      `,
      [
        crypto.randomUUID(),
        validatedFile.originalName,
        ossResult.storedName,
        validatedFile.fileExt,
        validatedFile.mimeType,
        validatedFile.sizeBytes,
        ossResult.bucket,
        ossResult.ossPath,
        ossResult.url,
        purpose,
      ]
    );

    return mapRowToRecord(result.rows[0]);
  }

  async listFiles() {
    await this.ensureTable();

    const result = await getPool().query<UploadedFileRow>(
      `
        SELECT *
        FROM uploaded_files
        ORDER BY created_at DESC
        LIMIT 100
      `
    );

    return result.rows.map(mapRowToRecord);
  }

  async getDownloadStream(fileIdValue: string | undefined): Promise<FileDownloadResult> {
    const record = await this.getFileRecord(fileIdValue);
    const stream = await this.getOssService().getFileStream(record.ossPath);

    return {
      record,
      stream,
    };
  }

  async getFileAccessUrl(fileIdValue: string | undefined) {
    const record = await this.getFileRecord(fileIdValue);

    return {
      record,
      url: this.getOssService().getAccessUrl(record.ossPath, record.url),
    };
  }

  async getFileRecord(fileIdValue: string | undefined) {
    await this.ensureTable();

    const fileId = validateFileId(fileIdValue);
    const result = await getPool().query<UploadedFileRow>(
      "SELECT * FROM uploaded_files WHERE id = $1",
      [fileId]
    );

    if (!result.rows[0]) {
      throw new FileNotFoundError(fileId);
    }

    return mapRowToRecord(result.rows[0]);
  }

  async updateFileStatus(
    fileIdValue: string | undefined,
    status: UploadedFileRecord["status"],
    errorMessage: string | null = null
  ) {
    await this.ensureTable();

    const fileId = validateFileId(fileIdValue);
    const result = await getPool().query<UploadedFileRow>(
      `
        UPDATE uploaded_files
        SET status = $2,
            error_message = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [fileId, status, errorMessage]
    );

    if (!result.rows[0]) {
      throw new FileNotFoundError(fileId);
    }

    return mapRowToRecord(result.rows[0]);
  }

  async ensureTable() {
    setupPromise ??= getPool().query(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id UUID PRIMARY KEY,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        file_ext TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
        oss_bucket TEXT NOT NULL,
        oss_path TEXT NOT NULL UNIQUE,
        url TEXT,
        purpose TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_uploaded_files_created_at
        ON uploaded_files (created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_uploaded_files_purpose
        ON uploaded_files (purpose);
    `).then(() => undefined).catch((error) => {
      setupPromise = undefined;
      throw error;
    });

    return setupPromise;
  }
}

export const filesService = new FilesService();
