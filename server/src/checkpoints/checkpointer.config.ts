import dotenv from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CheckpointerConfig, CheckpointType } from "./types.ts";
import { getLogLevel, logger, maskDatabaseUrl } from "../utils/logger.ts";

dotenv.config({ quiet: true });

const DEFAULT_CHECKPOINT_ENABLED = true;
const DEFAULT_CHECKPOINT_TYPE: CheckpointType = "memory";
const DEFAULT_CHECKPOINT_SQLITE_PATH = "./data/suvia-checkpoints.sqlite";
const CHECKPOINT_TYPES = new Set<CheckpointType>([
  "none",
  "memory",
  "sqlite",
  "postgres",
]);

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

let hasLoggedConfig = false;

const parseBooleanEnv = (value: string | undefined, defaultValue: boolean) => {
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
      throw new Error(
        `Invalid CHECKPOINT_ENABLED value "${value}". Expected true or false.`
      );
  }
};

const parseCheckpointType = (value: string | undefined): CheckpointType => {
  const rawType = value?.trim().toLowerCase() || DEFAULT_CHECKPOINT_TYPE;
  const type = rawType as CheckpointType;

  if (!CHECKPOINT_TYPES.has(type)) {
    throw new Error(
      `Invalid CHECKPOINT_TYPE "${value}". Expected one of: none, memory, sqlite, postgres.`
    );
  }

  return type;
};

const resolveSqlitePath = (value: string | undefined) => {
  const sqlitePath = value?.trim() || DEFAULT_CHECKPOINT_SQLITE_PATH;

  if (sqlitePath === ":memory:" || path.isAbsolute(sqlitePath)) {
    return sqlitePath;
  }

  return path.resolve(serverRoot, sqlitePath);
};

const ensureSqliteDirectory = (sqlitePath: string) => {
  if (sqlitePath === ":memory:") {
    return;
  }

  mkdirSync(path.dirname(sqlitePath), { recursive: true });
};

const resolvePostgresUrl = () => {
  return (
    process.env.CHECKPOINT_POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    undefined
  );
};

const logCheckpointerConfig = (config: CheckpointerConfig) => {
  if (hasLoggedConfig) {
    return;
  }

  hasLoggedConfig = true;

  logger.info("CONFIG", "Environment loaded");
  logger.info("CONFIG", `CHECKPOINT_ENABLED=${config.enabled}`);
  logger.info("CONFIG", `CHECKPOINT_TYPE=${config.type}`);

  if (process.env.CHECKPOINT_POSTGRES_URL?.trim()) {
    logger.info(
      "CONFIG",
      `CHECKPOINT_POSTGRES_URL=${maskDatabaseUrl(process.env.CHECKPOINT_POSTGRES_URL.trim())}`
    );
  } else if (process.env.DATABASE_URL?.trim()) {
    logger.info("CONFIG", `DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL.trim())}`);
  }

  logger.info("CONFIG", `LOG_LEVEL=${getLogLevel()}`);
};

export const getEffectiveCheckpointType = (config: CheckpointerConfig): CheckpointType => {
  return config.enabled ? config.type : "none";
};

export const formatSqlitePathForLog = (sqlitePath: string) => {
  if (sqlitePath === ":memory:" || !path.isAbsolute(sqlitePath)) {
    return sqlitePath;
  }

  const relativePath = path.relative(serverRoot, sqlitePath);

  if (relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
    return `./${relativePath.split(path.sep).join("/")}`;
  }

  return sqlitePath;
};

export const getCheckpointerConfig = (): CheckpointerConfig => {
  const enabled = parseBooleanEnv(
    process.env.CHECKPOINT_ENABLED,
    DEFAULT_CHECKPOINT_ENABLED
  );
  const type = enabled
    ? parseCheckpointType(process.env.CHECKPOINT_TYPE)
    : DEFAULT_CHECKPOINT_TYPE;
  const sqlitePath = resolveSqlitePath(process.env.CHECKPOINT_SQLITE_PATH);
  const postgresUrl = resolvePostgresUrl();

  if (enabled && type === "sqlite") {
    ensureSqliteDirectory(sqlitePath);
  }

  if (enabled && type === "postgres" && !postgresUrl) {
    throw new Error(
      "CHECKPOINT_TYPE=postgres requires CHECKPOINT_POSTGRES_URL or DATABASE_URL."
    );
  }

  const config = {
    enabled,
    type,
    sqlitePath,
    postgresUrl,
  };

  logCheckpointerConfig(config);

  return config;
};
