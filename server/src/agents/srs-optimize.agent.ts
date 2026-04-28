import { createAgent } from "langchain";
import { model } from "../models/index.ts";
import { srsOptimizePrompt } from "../prompts/srsOptimizePrompt.ts";
import { logger } from "../utils/logger.ts";

type SrsOptimizeAgent = ReturnType<typeof createAgent>;

let srsOptimizeAgent: SrsOptimizeAgent | undefined;

export const initSrsOptimizeAgent = () => {
  if (srsOptimizeAgent) {
    return srsOptimizeAgent;
  }

  logger.info("AGENT", "Creating SrsOptimizeAgent");

  srsOptimizeAgent = createAgent({
    model,
    tools: [],
    systemPrompt: srsOptimizePrompt,
  });

  logger.info("AGENT", "SrsOptimizeAgent ready");

  return srsOptimizeAgent;
};

export const getSrsOptimizeAgent = () => initSrsOptimizeAgent();

export type { SrsOptimizeAgent };
