import { createAgent } from "langchain";
import { initCheckpointer } from "../checkpoints/checkpointer.provider.ts";
import { model } from "../models/model.ts";
import { requirementPrompt } from "../prompts/requirementPrompt.ts";
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
      agent = createAgent({
        model,
        tools: [generateSrsImageTool],
        checkpointer,
        systemPrompt: requirementPrompt,
      });

      return agent;
    })
    .catch((error) => {
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
