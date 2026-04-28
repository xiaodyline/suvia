import { MemorySaver, type BaseCheckpointSaver } from "@langchain/langgraph";
import { createRequire } from "node:module";
import { getCheckpointerConfig } from "./checkpointer.config.ts";

type SqliteSaverModule = typeof import("@langchain/langgraph-checkpoint-sqlite");
type PostgresSaverModule =
  typeof import("@langchain/langgraph-checkpoint-postgres");

const require = createRequire(import.meta.url);

let checkpointer: BaseCheckpointSaver | undefined;
let isInitialized = false;
let initializationPromise: Promise<BaseCheckpointSaver | undefined> | undefined;

const assertNever = (value: never): never => {
  throw new Error(`Unsupported CHECKPOINT_TYPE "${value}".`);
};

const createCheckpointer = async (): Promise<
  BaseCheckpointSaver | undefined
> => {
  const config = getCheckpointerConfig();

  if (!config.enabled || config.type === "none") {
    return undefined;
  }

  switch (config.type) {
    case "memory":
      return new MemorySaver();
    case "sqlite": {
      const { SqliteSaver } = require(
        "@langchain/langgraph-checkpoint-sqlite"
      ) as SqliteSaverModule;
      return SqliteSaver.fromConnString(config.sqlitePath);
    }
    case "postgres": {
      if (!config.postgresUrl) {
        throw new Error(
          "CHECKPOINT_TYPE=postgres requires CHECKPOINT_POSTGRES_URL or DATABASE_URL."
        );
      }

      const { PostgresSaver } = (await import(
        "@langchain/langgraph-checkpoint-postgres"
      )) as PostgresSaverModule;
      const postgresSaver = PostgresSaver.fromConnString(config.postgresUrl);

      try {
        await postgresSaver.setup();
      } catch (error) {
        await postgresSaver.end().catch(() => undefined);
        throw error;
      }

      return postgresSaver;
    }
    default:
      return assertNever(config.type);
  }
};

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
