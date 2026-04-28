import { createAgent } from "langchain";
import { model } from "../models/index.ts";
import { srsReviewPrompt } from "../prompts/srsReviewPrompt.ts";
import { logger } from "../utils/logger.ts";

type SrsReviewAgent = ReturnType<typeof createAgent>;

let srsReviewAgent: SrsReviewAgent | undefined;

export const initSrsReviewAgent = () => {
  if (srsReviewAgent) {
    return srsReviewAgent;
  }

  logger.info("AGENT", "Creating SrsReviewAgent");

  srsReviewAgent = createAgent({
    model,
    tools: [],
    systemPrompt: srsReviewPrompt,
  });

  logger.info("AGENT", "SrsReviewAgent ready");

  return srsReviewAgent;
};

export const getSrsReviewAgent = () => initSrsReviewAgent();

export type { SrsReviewAgent };
