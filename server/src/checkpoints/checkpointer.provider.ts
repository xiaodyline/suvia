import { MemorySaver, type BaseCheckpointSaver } from "@langchain/langgraph";
import { createRequire } from "node:module";
import { getCheckpointerConfig } from "./checkpointer.config.ts";

type SqliteSaverModule = typeof import("@langchain/langgraph-checkpoint-sqlite");

const require = createRequire(import.meta.url);

let checkpointer: BaseCheckpointSaver | undefined;
let isInitialized = false;

const assertNever = (value: never): never => {
  throw new Error(`Unsupported CHECKPOINT_TYPE "${value}".`);
};

const createCheckpointer = (): BaseCheckpointSaver | undefined => {
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
    default:
      return assertNever(config.type);
  }
};

export const getCheckpointer = () => {
  if (!isInitialized) {
    checkpointer = createCheckpointer();
    isInitialized = true;
  }

  return checkpointer;
};
