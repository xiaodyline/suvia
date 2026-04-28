import { ChatOpenAI } from "@langchain/openai";
import {
  getModelConfig,
  requireProviderApiKey,
  type CommonModelConfig,
  type ProviderChatModelConfig,
} from "./model.config.ts";

export const createOpenAIChatModel = (
  providerConfig?: ProviderChatModelConfig,
  commonConfig?: CommonModelConfig
) => {
  const resolvedConfig = getModelConfig();
  const openaiConfig = providerConfig ?? resolvedConfig.openai;
  const common = commonConfig ?? resolvedConfig.common;

  requireProviderApiKey("openai", openaiConfig.apiKey, "OPENAI_API_KEY");

  return new ChatOpenAI({
    model: openaiConfig.model,
    apiKey: openaiConfig.apiKey,
    maxRetries: common.maxRetries,
    streamUsage: common.streamUsage,
    useResponsesApi: common.useResponsesApi ?? true,
    configuration: {
      baseURL: openaiConfig.apiUrl,
    },
  });
};
