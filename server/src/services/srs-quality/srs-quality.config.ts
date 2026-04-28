import "../../config/env.ts";
import { logger } from "../../utils/logger.ts";
import type { SrsQualityConfig } from "./srs-quality.types.ts";

const DEFAULT_REVIEW_ENABLED = true;
const DEFAULT_AUTO_OPTIMIZE_ENABLED = true;
const DEFAULT_SCORE_THRESHOLD = 85;
const DEFAULT_MAX_OPTIMIZE_ROUNDS = 3;
const DEFAULT_MIN_SCORE_IMPROVEMENT = 3;

const readStringEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value || undefined;
};

const parseBooleanEnv = (name: string, defaultValue: boolean) => {
  const value = readStringEnv(name);

  if (value === undefined) {
    return defaultValue;
  }

  switch (value.toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      throw new Error(`Invalid ${name} value "${value}". Expected true or false.`);
  }
};

const parseNumberEnv = (name: string, defaultValue: number) => {
  const value = readStringEnv(name);

  if (value === undefined) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Invalid ${name} value "${value}". Expected a number.`);
  }

  return parsedValue;
};

const parseIntegerEnv = (name: string, defaultValue: number) => {
  const parsedValue = parseNumberEnv(name, defaultValue);

  if (!Number.isInteger(parsedValue)) {
    throw new Error(`Invalid ${name} value "${parsedValue}". Expected an integer.`);
  }

  return parsedValue;
};

const assertRange = (
  name: string,
  value: number,
  { min, max }: { min: number; max?: number }
) => {
  if (value < min || (max !== undefined && value > max)) {
    const suffix = max === undefined ? `>= ${min}` : `between ${min} and ${max}`;
    throw new Error(`Invalid ${name} value "${value}". Expected ${suffix}.`);
  }
};

export const getSrsQualityConfig = (): SrsQualityConfig => {
  const config: SrsQualityConfig = {
    reviewEnabled: parseBooleanEnv(
      "SRS_REVIEW_ENABLED",
      DEFAULT_REVIEW_ENABLED
    ),
    autoOptimizeEnabled: parseBooleanEnv(
      "SRS_AUTO_OPTIMIZE_ENABLED",
      DEFAULT_AUTO_OPTIMIZE_ENABLED
    ),
    scoreThreshold: parseNumberEnv(
      "SRS_SCORE_THRESHOLD",
      DEFAULT_SCORE_THRESHOLD
    ),
    maxOptimizeRounds: parseIntegerEnv(
      "SRS_MAX_OPTIMIZE_ROUNDS",
      DEFAULT_MAX_OPTIMIZE_ROUNDS
    ),
    minScoreImprovement: parseNumberEnv(
      "SRS_MIN_SCORE_IMPROVEMENT",
      DEFAULT_MIN_SCORE_IMPROVEMENT
    ),
  };

  assertRange("SRS_SCORE_THRESHOLD", config.scoreThreshold, { min: 0, max: 100 });
  assertRange("SRS_MAX_OPTIMIZE_ROUNDS", config.maxOptimizeRounds, { min: 0 });
  assertRange("SRS_MIN_SCORE_IMPROVEMENT", config.minScoreImprovement, {
    min: 0,
  });

  return config;
};

export const logSrsQualityConfig = () => {
  const config = getSrsQualityConfig();

  logger.info("QUALITY", "SRS quality config", {
    reviewEnabled: config.reviewEnabled,
    autoOptimizeEnabled: config.autoOptimizeEnabled,
    scoreThreshold: config.scoreThreshold,
    maxOptimizeRounds: config.maxOptimizeRounds,
    minScoreImprovement: config.minScoreImprovement,
  });
};
