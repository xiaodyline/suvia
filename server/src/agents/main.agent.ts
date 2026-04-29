import { createAgent, summarizationMiddleware, type AgentMiddleware } from "langchain";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import {
  getSummarizationConfig,
  logSummarizationConfig,
} from "../config/summarization.config.ts";
import { model } from "../models/index.ts";
import { mainAgentPrompt } from "../prompts/mainAgentPrompt.ts";
import { requirementWriterAgentTool } from "../tools/requirement-agent.tool.ts";
import { initRequirementWriterAgent } from "./requirement.agent.ts";

type CreateMainAgentOptions = {
  checkpointer?: BaseCheckpointSaver;
};

const summaryPrompt = `You are summarizing the historical conversation for Suvia's MainAgent.

Keep only durable context that should guide future turns. Preserve:
- the user's project name, business background, user roles, and feature scope;
- explicit SRS/document requirements, including format, heading levels, image generation or insertion requirements, output language, and writing constraints;
- explicit prohibitions and "must not" requirements;
- current task progress and decisions the user has confirmed.

Remove irrelevant small talk, duplicated text, and failed intermediate attempts. Do not treat failed drafts, tool errors, or rejected output as final requirements. Do not invent information that the user has not confirmed.

The newest messages are kept outside this summary, so do not overwrite or reinterpret the user's latest message.

Write the summary in the same primary language as the conversation. Respond only with the extracted context.

<messages>
{messages}
</messages>`;

export const createMainAgent = ({ checkpointer }: CreateMainAgentOptions) => {
  const summarizationConfig = getSummarizationConfig();
  const middleware: AgentMiddleware[] = [];

  logSummarizationConfig(summarizationConfig);
  initRequirementWriterAgent();

  if (summarizationConfig.enabled) {
    middleware.push(
      summarizationMiddleware({
        model,
        trigger: { messages: summarizationConfig.trigger },
        keep: { messages: summarizationConfig.keep },
        summaryPrompt,
      })
    );
  }

  return createAgent({
    model,
    tools: [requirementWriterAgentTool],
    checkpointer,
    systemPrompt: mainAgentPrompt,
    middleware,
  });
};

export type MainAgent = ReturnType<typeof createMainAgent>;
