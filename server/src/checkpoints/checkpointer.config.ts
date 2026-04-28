import dotenv from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CheckpointerConfig, CheckpointType } from "./types.ts";

dotenv.config();

const DEFAULT_CHECKPOINT_ENABLED = true;
const DEFAULT_CHECKPOINT_TYPE: CheckpointType = "memory";
const DEFAULT_CHECKPOINT_SQLITE_PATH = "./data/suvia-checkpoints.sqlite";
const CHECKPOINT_TYPES = new Set<CheckpointType>(["none", "memory", "sqlite"]);

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

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
      `Invalid CHECKPOINT_TYPE "${value}". Expected one of: none, memory, sqlite.`
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

export const getCheckpointerConfig = (): CheckpointerConfig => {
  const enabled = parseBooleanEnv(
    process.env.CHECKPOINT_ENABLED,
    DEFAULT_CHECKPOINT_ENABLED
  );
  const type = enabled
    ? parseCheckpointType(process.env.CHECKPOINT_TYPE)
    : DEFAULT_CHECKPOINT_TYPE;
  const sqlitePath = resolveSqlitePath(process.env.CHECKPOINT_SQLITE_PATH);

  if (enabled && type === "sqlite") {
    ensureSqliteDirectory(sqlitePath);
  }

  return {
    enabled,
    type,
    sqlitePath,
  };
};
