import { createAgent } from "langchain";
// import { MemorySaver } from "@langchain/langgraph";
import { model } from "../models/model.ts";
import { requirementPrompt } from "../prompts/requirementPrompt.ts";
import { generateSrsImageTool } from "./image-agent.ts";

export const RequirementWriterAgent = createAgent({
  model,
  tools: [generateSrsImageTool],
  // checkpointer: new MemorySaver(),
  systemPrompt: requirementPrompt,
});

export const agent = RequirementWriterAgent;
