import { createAgent } from "langchain";
import { getCheckpointer } from "../checkpoints/checkpointer.provider.ts";
import { model } from "../models/model.ts";
import { requirementPrompt } from "../prompts/requirementPrompt.ts";
import { generateSrsImageTool } from "./image-agent.ts";

const checkpointer = getCheckpointer();

export const RequirementWriterAgent = createAgent({
  model,
  tools: [generateSrsImageTool],
  checkpointer,
  systemPrompt: requirementPrompt,
});

export const agent = RequirementWriterAgent;
