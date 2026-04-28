import { createAgent } from "langchain";
import { model } from "../models/model.ts";
import { requirementPrompt } from "../prompts/requirementPrompt.ts";
import { logger } from "../utils/logger.ts";
import { generateSrsImageTool } from "./image-agent.ts";

type RequirementWriterAgent = ReturnType<typeof createAgent>;

let requirementWriterAgent: RequirementWriterAgent | undefined;

export const initRequirementWriterAgent = () => {
  if (requirementWriterAgent) {
    return requirementWriterAgent;
  }

  logger.info("AGENT", "Creating RequirementWriterAgent");
  logger.info("AGENT", "Tools=generate_srs_image");

  requirementWriterAgent = createAgent({
    model,
    tools: [generateSrsImageTool],
    systemPrompt: requirementPrompt,
  });

  logger.info("AGENT", "RequirementWriterAgent ready");

  return requirementWriterAgent;
};

export const getRequirementWriterAgent = () => initRequirementWriterAgent();

export type { RequirementWriterAgent };
