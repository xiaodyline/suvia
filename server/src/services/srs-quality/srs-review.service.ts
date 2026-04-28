import * as z from "zod";
import { getSrsReviewAgent } from "../../agents/srs-review.agent.ts";
import { logger } from "../../utils/logger.ts";
import { extractFinalTextFromAgentResult } from "./srs-agent-output.ts";
import type { SrsReviewResult } from "./srs-quality.types.ts";

const dimensionMaxScores = new Map<string, number>([
  ["需求完整性", 25],
  ["结构规范性", 15],
  ["表述清晰性", 15],
  ["业务一致性", 15],
  ["可实现性", 10],
  ["可验证性", 10],
  ["文档正式性", 10],
]);

const srsReviewDimensionSchema = z.object({
  name: z.string().min(1),
  score: z.coerce.number(),
  maxScore: z.coerce.number(),
  comments: z.coerce.string(),
});

const srsReviewResultSchema = z.object({
  totalScore: z.coerce.number(),
  dimensions: z.array(srsReviewDimensionSchema),
  problems: z.array(z.string()),
  suggestions: z.array(z.string()),
  summary: z.coerce.string(),
});

const stripJsonFence = (text: string) => {
  const trimmedText = text.trim();
  const fenceMatch = trimmedText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch?.[1]?.trim() ?? trimmedText;
};

const findJsonObjectText = (text: string): string | undefined => {
  const startIndex = text.indexOf("{");

  if (startIndex === -1) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return undefined;
};

const parseReviewJson = (text: string): unknown => {
  const unfencedText = stripJsonFence(text);

  try {
    return JSON.parse(unfencedText);
  } catch {
    const jsonObjectText = findJsonObjectText(unfencedText);

    if (!jsonObjectText) {
      throw new Error("SRS review agent returned non-JSON content.");
    }

    try {
      return JSON.parse(jsonObjectText);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown JSON parse error.";
      throw new Error(`SRS review agent returned invalid JSON: ${message}`);
    }
  }
};

const validateReviewResult = (value: unknown): SrsReviewResult => {
  const result = srsReviewResultSchema.parse(value);

  if (result.totalScore < 0 || result.totalScore > 100) {
    throw new Error("totalScore must be between 0 and 100.");
  }

  if (result.dimensions.length !== dimensionMaxScores.size) {
    throw new Error(
      `dimensions must contain exactly ${dimensionMaxScores.size} items.`
    );
  }

  const seenDimensions = new Set<string>();
  const maxScoreTotal = result.dimensions.reduce((total, dimension) => {
    const expectedMaxScore = dimensionMaxScores.get(dimension.name);

    if (expectedMaxScore === undefined) {
      throw new Error(`Unknown review dimension "${dimension.name}".`);
    }

    if (seenDimensions.has(dimension.name)) {
      throw new Error(`Duplicate review dimension "${dimension.name}".`);
    }

    seenDimensions.add(dimension.name);

    if (dimension.maxScore !== expectedMaxScore) {
      throw new Error(
        `Dimension "${dimension.name}" maxScore must be ${expectedMaxScore}.`
      );
    }

    if (dimension.score < 0 || dimension.score > dimension.maxScore) {
      throw new Error(
        `Dimension "${dimension.name}" score must be between 0 and ${dimension.maxScore}.`
      );
    }

    return total + dimension.maxScore;
  }, 0);

  if (maxScoreTotal !== 100) {
    throw new Error("dimensions maxScore total must be 100.");
  }

  return result;
};

const buildReviewPrompt = (document: string) => {
  return [
    "请评审以下 SRS / 需求分析说明书，并只返回符合系统要求的评分 JSON。",
    "",
    "<SRS_DOCUMENT>",
    document,
    "</SRS_DOCUMENT>",
  ].join("\n");
};

export const reviewSrsDocument = async (
  document: string
): Promise<SrsReviewResult> => {
  logger.info("QUALITY", "SRS review started");

  try {
    const agent = getSrsReviewAgent();
    const result = await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: buildReviewPrompt(document),
          },
        ],
      },
      {
        tags: ["subagent", "srs_review_agent"],
        metadata: {
          source: "srs_review_agent",
        },
      }
    );
    const outputText = extractFinalTextFromAgentResult(result);

    if (!outputText) {
      throw new Error("SRS review agent returned no text content.");
    }

    const reviewResult = validateReviewResult(parseReviewJson(outputText));

    logger.info("QUALITY", "SRS review completed", {
      score: reviewResult.totalScore,
    });

    return reviewResult;
  } catch (error) {
    logger.error("QUALITY", "SRS review failed", error);
    const message =
      error instanceof Error ? error.message : "Unknown SRS review error.";
    throw new Error(`SRS review failed: ${message}`);
  }
};

export const srsReviewService = {
  review: reviewSrsDocument,
};
