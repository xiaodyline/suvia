import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { model } from "../models/model.ts";
import { requirementPrompt } from "../prompts/requirementPrompt.ts";
import { generateSrsImageTool } from "./image-agent.ts";

const checkpointer = new MemorySaver();

export const RequirementWriterAgent = createAgent({
  model,
  tools: [generateSrsImageTool],
  checkpointer,
  systemPrompt: requirementPrompt,
});

export const agent = RequirementWriterAgent;
