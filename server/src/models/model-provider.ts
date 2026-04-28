import type { ChatOpenAI } from "@langchain/openai";
import { createDeepSeekChatModel } from "./deepseek.model.ts";
import { getModelConfig } from "./model.config.ts";
import { createOpenAIChatModel } from "./openai.model.ts";

export const createChatModel = (): ChatOpenAI => {
  const config = getModelConfig();

  switch (config.provider) {
    case "openai":
      return createOpenAIChatModel(config.openai, config.common);
    case "deepseek":
      return createDeepSeekChatModel(config.deepseek, config.common);
    default:
      throw new Error(
        `Unsupported MODEL_PROVIDER "${config.provider}". Expected one of: openai, deepseek.`
      );
  }
};

export const model = createChatModel();
