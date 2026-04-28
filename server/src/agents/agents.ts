import { createAgent } from "langchain";
import {
  getInitializedCheckpointType,
  initCheckpointer,
} from "../checkpoints/checkpointer.provider.ts";
import { model } from "../models/model.ts";
import { requirementPrompt } from "../prompts/requirementPrompt.ts";
import { logger } from "../utils/logger.ts";
import { generateSrsImageTool } from "./image-agent.ts";

type RequirementAgent = ReturnType<typeof createAgent>;

let agent: RequirementAgent | undefined;
let initializationPromise: Promise<RequirementAgent> | undefined;

export const initAgent = async () => {
  if (agent) {
    return agent;
  }

  initializationPromise ??= initCheckpointer()
    .then((checkpointer) => {
      logger.info("AGENT", "Creating RequirementWriterAgent");
      logger.info("AGENT", "Tools=generate_srs_image");
      logger.info("AGENT", `Checkpointer=${getInitializedCheckpointType()}`);

      agent = createAgent({
        model,
        tools: [generateSrsImageTool],
        checkpointer,
        systemPrompt: requirementPrompt,
      });

      logger.info("AGENT", "RequirementWriterAgent ready");

      return agent;
    })
    .catch((error) => {
      logger.error("AGENT", "RequirementWriterAgent initialization failed", error);
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
