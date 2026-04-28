import { createAgent } from "langchain";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { model } from "../models/model.ts";
import { mainAgentPrompt } from "../prompts/mainAgentPrompt.ts";
import { requirementWriterAgentTool } from "../tools/requirement-agent.tool.ts";
import { initRequirementWriterAgent } from "./requirement-agent.ts";

type CreateMainAgentOptions = {
  checkpointer?: BaseCheckpointSaver;
};

export const createMainAgent = ({ checkpointer }: CreateMainAgentOptions) => {
  initRequirementWriterAgent();

  return createAgent({
    model,
    tools: [requirementWriterAgentTool],
    checkpointer,
    systemPrompt: mainAgentPrompt,
  });
};

export type MainAgent = ReturnType<typeof createMainAgent>;
