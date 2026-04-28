import {
  getInitializedCheckpointType,
  initCheckpointer,
} from "../checkpoints/checkpointer.provider.ts";
import { logSrsQualityConfig } from "../services/srs-quality/srs-quality.config.ts";
import { logger } from "../utils/logger.ts";
import { createMainAgent, type MainAgent } from "./main.agent.ts";

let agent: MainAgent | undefined;
let initializationPromise: Promise<MainAgent> | undefined;

export const initAgent = async () => {
  if (agent) {
    return agent;
  }

  initializationPromise ??= initCheckpointer()
    .then((checkpointer) => {
      logger.info("AGENT", "Creating MainAgent");
      logger.info("AGENT", `Checkpointer=${getInitializedCheckpointType()}`);
      logSrsQualityConfig();

      agent = createMainAgent({ checkpointer });

      logger.info(
        "AGENT",
        "Sub agents=RequirementWriterAgent,SrsReviewAgent,SrsOptimizeAgent"
      );
      logger.info("AGENT", "MainAgent ready");

      return agent;
    })
    .catch((error) => {
      logger.error("AGENT", "MainAgent initialization failed", error);
      initializationPromise = undefined;
      throw error;
    });

  return initializationPromise;
};

export const getAgent = () => {
  if (!agent) {
    throw new Error(
      "Agent has not been initialized. Call initAgent() during server startup."
    );
  }

  return agent;
};
