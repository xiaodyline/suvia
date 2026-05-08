import "../../config/env.ts";
import { resolvePostgresUrl } from "../../checkpoints/checkpointer.config.ts";

export const SUPPORTED_FILE_EXTENSIONS = new Set(["pdf", "md", "markdown"]);

export type FilesConfig = {
  maxSizeMb: number;
  maxSizeBytes: number;
  allowedExtensions: Set<string>;
  defaultPurpose: string;
  signedUrlExpiresSeconds: number;
};

export type OssFileConfig = {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  publicBaseUrl?: string;
  privateRead: boolean;
  signedUrlExpiresSeconds: number;
};

const DEFAULT_FILE_MAX_SIZE_MB = 30;
const DEFAULT_FILE_ALLOWED_EXTENSIONS = ["pdf", "md", "markdown"];
const DEFAULT_FILE_UPLOAD_PURPOSE = "rag";
const DEFAULT_SIGNED_URL_EXPIRES_SECONDS = 900;

const parsePositiveNumber = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
};

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return defaultValue;
  }
};

const parseAllowedExtensions = (value: string | undefined) => {
  const rawExtensions = value?.trim()
    ? value.split(",")
    : DEFAULT_FILE_ALLOWED_EXTENSIONS;

  const allowedExtensions = rawExtensions
    .map((extension) => extension.trim().toLowerCase().replace(/^\./, ""))
    .filter((extension) => SUPPORTED_FILE_EXTENSIONS.has(extension));

  return new Set(
    allowedExtensions.length > 0
      ? allowedExtensions
      : DEFAULT_FILE_ALLOWED_EXTENSIONS
  );
};

export const getFilesConfig = (): FilesConfig => {
  const maxSizeMb = parsePositiveNumber(
    process.env.FILE_MAX_SIZE_MB,
    DEFAULT_FILE_MAX_SIZE_MB
  );

  return {
    maxSizeMb,
    maxSizeBytes: Math.floor(maxSizeMb * 1024 * 1024),
    allowedExtensions: parseAllowedExtensions(process.env.FILE_ALLOWED_EXTENSIONS),
    defaultPurpose:
      process.env.FILE_UPLOAD_PURPOSE_DEFAULT?.trim() ||
      DEFAULT_FILE_UPLOAD_PURPOSE,
    signedUrlExpiresSeconds: Math.floor(
      parsePositiveNumber(
        process.env.OSS_SIGNED_URL_EXPIRES_SECONDS,
        DEFAULT_SIGNED_URL_EXPIRES_SECONDS
      )
    ),
  };
};

export const getFilesDatabaseUrl = () => {
  const postgresUrl = resolvePostgresUrl();

  if (!postgresUrl) {
    throw new Error(
      "File storage requires CHECKPOINT_POSTGRES_URL or DATABASE_URL."
    );
  }

  return postgresUrl;
};

export const getOssFileConfig = (): OssFileConfig => {
  const region = process.env.OSS_REGION?.trim();
  const bucket = process.env.OSS_BUCKET?.trim();
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim();

  if (!region) throw new Error("Missing OSS_REGION.");
  if (!bucket) throw new Error("Missing OSS_BUCKET.");
  if (!accessKeyId) throw new Error("Missing OSS_ACCESS_KEY_ID.");
  if (!accessKeySecret) throw new Error("Missing OSS_ACCESS_KEY_SECRET.");

  return {
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
    publicBaseUrl: process.env.OSS_PUBLIC_BASE_URL?.trim() || undefined,
    privateRead: parseBoolean(process.env.OSS_PRIVATE_READ, false),
    signedUrlExpiresSeconds: getFilesConfig().signedUrlExpiresSeconds,
  };
};
