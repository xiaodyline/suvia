import "./env.ts";
import { logger } from "../utils/logger.ts";

const DEFAULT_SUMMARY_ENABLED = true;
const DEFAULT_SUMMARY_TRIGGER = 20;
const DEFAULT_SUMMARY_KEEP = 8;

export type SummarizationConfig = {
  enabled: boolean;
  trigger: number;
  keep: number;
};

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

const parsePositiveIntegerEnv = (name: string, defaultValue: number) => {
  const value = readStringEnv(name);

  if (value === undefined) {
    return defaultValue;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`Invalid ${name} value "${value}". Expected a positive integer.`);
  }

  return Number(value);
};

const readSummarizationConfig = (): SummarizationConfig => {
  const config: SummarizationConfig = {
    enabled: parseBooleanEnv("SUMMARY_ENABLED", DEFAULT_SUMMARY_ENABLED),
    trigger: parsePositiveIntegerEnv("SUMMARY_TRIGGER", DEFAULT_SUMMARY_TRIGGER),
    keep: parsePositiveIntegerEnv("SUMMARY_KEEP", DEFAULT_SUMMARY_KEEP),
  };

  if (config.keep >= config.trigger) {
    throw new Error(
      `Invalid SUMMARY_KEEP value "${config.keep}". Expected less than SUMMARY_TRIGGER (${config.trigger}).`
    );
  }

  return config;
};

export const getSummarizationConfig = (): SummarizationConfig => {
  try {
    return readSummarizationConfig();
  } catch (error) {
    logger.error("AGENT", "Summarization config invalid", error);
    throw error;
  }
};

export const logSummarizationConfig = (config: SummarizationConfig) => {
  if (!config.enabled) {
    logger.info("AGENT", "Summarization enabled=false");
    return;
  }

  logger.info(
    "AGENT",
    `Summarization enabled=true trigger=${config.trigger} keep=${config.keep}`
  );
};
