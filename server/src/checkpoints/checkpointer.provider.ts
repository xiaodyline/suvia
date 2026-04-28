import { MemorySaver, type BaseCheckpointSaver } from "@langchain/langgraph";
import { createRequire } from "node:module";
import {
  formatSqlitePathForLog,
  getCheckpointerConfig,
  getEffectiveCheckpointType,
} from "./checkpointer.config.ts";
import type { CheckpointType } from "./types.ts";
import { describePostgresConnection, logger } from "../utils/logger.ts";

type SqliteSaverModule = typeof import("@langchain/langgraph-checkpoint-sqlite");
type PostgresSaverModule =
  typeof import("@langchain/langgraph-checkpoint-postgres");

const require = createRequire(import.meta.url);

let checkpointer: BaseCheckpointSaver | undefined;
let initializedCheckpointType: CheckpointType = "none";
let isInitialized = false;
let initializationPromise: Promise<BaseCheckpointSaver | undefined> | undefined;

const assertNever = (value: never): never => {
  throw new Error(`Unsupported CHECKPOINT_TYPE "${value}".`);
};

const createCheckpointer = async (): Promise<
  BaseCheckpointSaver | undefined
> => {
  const config = getCheckpointerConfig();
  const effectiveType = getEffectiveCheckpointType(config);
  initializedCheckpointType = effectiveType;

  logger.info("CHECKPOINT", "Initializing checkpointer");
  logger.info("CHECKPOINT", `Enabled=${config.enabled}`);
  logger.info("CHECKPOINT", `Type=${effectiveType}`);

  if (effectiveType === "none") {
    logger.info("CHECKPOINT", "Disabled");
    return undefined;
  }

  switch (effectiveType) {
    case "memory": {
      logger.info("CHECKPOINT", "MemorySaver initializing");
      const memorySaver = new MemorySaver();
      logger.info("CHECKPOINT", "MemorySaver initialized");
      return memorySaver;
    }
    case "sqlite": {
      logger.info("CHECKPOINT", "SQLite checkpointer initializing");
      logger.info("CHECKPOINT", `SQLite path=${formatSqlitePathForLog(config.sqlitePath)}`);
      const { SqliteSaver } = require(
        "@langchain/langgraph-checkpoint-sqlite"
      ) as SqliteSaverModule;
      const sqliteSaver = SqliteSaver.fromConnString(config.sqlitePath);
      logger.info("CHECKPOINT", "SQLite checkpointer initialized");
      return sqliteSaver;
    }
    case "postgres": {
      if (!config.postgresUrl) {
        throw new Error(
          "CHECKPOINT_TYPE=postgres requires CHECKPOINT_POSTGRES_URL or DATABASE_URL."
        );
      }

      logger.info("CHECKPOINT", "PostgreSQL checkpointer initializing");
      const connection = describePostgresConnection(config.postgresUrl);

      if (connection) {
        logger.info("CHECKPOINT", "PostgreSQL", connection);
      }

      const { PostgresSaver } = (await import(
        "@langchain/langgraph-checkpoint-postgres"
      )) as PostgresSaverModule;
      const postgresSaver = PostgresSaver.fromConnString(config.postgresUrl);

      try {
        await postgresSaver.setup();
        logger.info("CHECKPOINT", "PostgreSQL checkpointer initialized");
      } catch (error) {
        logger.error(
          "CHECKPOINT",
          "PostgreSQL checkpointer initialization failed",
          error
        );
        await postgresSaver.end().catch(() => undefined);
        throw error;
      }

      return postgresSaver;
    }
    default:
      return assertNever(effectiveType);
  }
};

export const getInitializedCheckpointType = () => initializedCheckpointType;

export const getCheckpointer = () => {
  if (!isInitialized) {
    throw new Error(
      "Checkpointer has not been initialized. Call initCheckpointer() during server startup."
    );
  }

  return checkpointer;
};

export const initCheckpointer = async () => {
  if (isInitialized) {
    return checkpointer;
  }

  initializationPromise ??= createCheckpointer()
    .then((createdCheckpointer) => {
      checkpointer = createdCheckpointer;
      isInitialized = true;
      return checkpointer;
    })
    .catch((error) => {
      initializationPromise = undefined;
      throw error;
    });

  return initializationPromise;
};
