import { ChatOpenAI } from "@langchain/openai";
import {
  getModelConfig,
  requireProviderApiKey,
  type CommonModelConfig,
  type ProviderChatModelConfig,
} from "./model.config.ts";

export const createDeepSeekChatModel = (
  providerConfig?: ProviderChatModelConfig,
  commonConfig?: CommonModelConfig
) => {
  const resolvedConfig = getModelConfig();
  const deepseekConfig = providerConfig ?? resolvedConfig.deepseek;
  const common = commonConfig ?? resolvedConfig.common;

  requireProviderApiKey("deepseek", deepseekConfig.apiKey, "DEEPSEEK_API_KEY");

  return new ChatOpenAI({
    model: deepseekConfig.model,
    apiKey: deepseekConfig.apiKey,
    maxRetries: common.maxRetries,
    streamUsage: common.streamUsage,
    useResponsesApi: common.useResponsesApi ?? false,
    configuration: {
      baseURL: deepseekConfig.apiUrl,
    },
  });
};
