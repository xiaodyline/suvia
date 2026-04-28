import "../config/env.ts";

export type SupportedModelProvider = "openai" | "deepseek";
export type ModelProvider = SupportedModelProvider | string;

export type CommonModelConfig = {
  maxRetries: number;
  streamUsage: boolean;
  useResponsesApi?: boolean;
};

export type ProviderChatModelConfig = {
  apiUrl: string;
  apiKey?: string;
  model: string;
};

export type ModelConfig = {
  provider: ModelProvider;
  common: CommonModelConfig;
  openai: ProviderChatModelConfig;
  deepseek: ProviderChatModelConfig;
};

const DEFAULT_MODEL_PROVIDER: SupportedModelProvider = "openai";
const DEFAULT_OPENAI_API_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_DEEPSEEK_API_URL = "https://api.deepseek.com/v1";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_MODEL_MAX_RETRIES = 5;
const DEFAULT_MODEL_STREAM_USAGE = false;

function readStringEnv(name: string): string | undefined;
function readStringEnv(name: string, defaultValue: string): string;
function readStringEnv(name: string, defaultValue?: string) {
  const value = process.env[name]?.trim();
  return value || defaultValue;
}

const parseBooleanEnv = (
  name: string,
  defaultValue: boolean | undefined
) => {
  const value = process.env[name]?.trim();

  if (!value) {
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

const parseIntegerEnv = (name: string, defaultValue: number) => {
  const value = process.env[name]?.trim();

  if (!value) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`Invalid ${name} value "${value}". Expected a non-negative integer.`);
  }

  return parsedValue;
};

export function requireProviderApiKey(
  provider: SupportedModelProvider,
  apiKey: string | undefined,
  envName: string
): asserts apiKey is string {
  if (!apiKey) {
    throw new Error(`MODEL_PROVIDER=${provider} requires ${envName} in server/.env.`);
  }
}

export const getModelConfig = (): ModelConfig => {
  return {
    provider:
      readStringEnv("MODEL_PROVIDER", DEFAULT_MODEL_PROVIDER)?.toLowerCase() ??
      DEFAULT_MODEL_PROVIDER,
    common: {
      maxRetries: parseIntegerEnv("MODEL_MAX_RETRIES", DEFAULT_MODEL_MAX_RETRIES),
      streamUsage: parseBooleanEnv(
        "MODEL_STREAM_USAGE",
        DEFAULT_MODEL_STREAM_USAGE
      ) as boolean,
      useResponsesApi: parseBooleanEnv("MODEL_USE_RESPONSES_API", undefined),
    },
    openai: {
      apiUrl: readStringEnv("OPENAI_API_URL", DEFAULT_OPENAI_API_URL),
      apiKey: readStringEnv("OPENAI_API_KEY"),
      model: readStringEnv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
    },
    deepseek: {
      apiUrl: readStringEnv("DEEPSEEK_API_URL", DEFAULT_DEEPSEEK_API_URL),
      apiKey: readStringEnv("DEEPSEEK_API_KEY"),
      model: readStringEnv("DEEPSEEK_MODEL", DEFAULT_DEEPSEEK_MODEL),
    },
  };
};
