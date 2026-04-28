import { getSrsOptimizeAgent } from "../../agents/srs-optimize.agent.ts";
import { logger } from "../../utils/logger.ts";
import { extractFinalTextFromAgentResult } from "./srs-agent-output.ts";
import type { SrsReviewResult } from "./srs-quality.types.ts";

export type OptimizeSrsDocumentInput = {
  document: string;
  review: SrsReviewResult;
  round: number;
};

const buildOptimizePrompt = ({
  document,
  review,
  round,
}: OptimizeSrsDocumentInput) => {
  return [
    `当前优化轮次：${round}`,
    "",
    "当前评分结果：",
    JSON.stringify(review, null, 2),
    "",
    "请根据评分问题和优化建议，对以下 SRS 文档进行定向优化。只输出优化后的 SRS 正文。",
    "",
    "<CURRENT_SRS_DOCUMENT>",
    document,
    "</CURRENT_SRS_DOCUMENT>",
  ].join("\n");
};

export const optimizeSrsDocument = async ({
  document,
  review,
  round,
}: OptimizeSrsDocumentInput): Promise<string> => {
  logger.info("QUALITY", "SRS optimize started", { round });

  try {
    const agent = getSrsOptimizeAgent();
    const result = await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: buildOptimizePrompt({ document, review, round }),
          },
        ],
      },
      {
        tags: ["subagent", "srs_optimize_agent"],
        metadata: {
          source: "srs_optimize_agent",
        },
      }
    );
    const optimizedDocument = extractFinalTextFromAgentResult(result).trim();

    if (!optimizedDocument) {
      throw new Error("SRS optimize agent returned no text content.");
    }

    logger.info("QUALITY", "SRS optimize completed", { round });

    return optimizedDocument;
  } catch (error) {
    logger.error("QUALITY", "SRS optimize failed", error, { round });
    const message =
      error instanceof Error ? error.message : "Unknown SRS optimize error.";
    throw new Error(`SRS optimize failed round=${round}: ${message}`);
  }
};

export const srsOptimizeService = {
  optimize: optimizeSrsDocument,
};
