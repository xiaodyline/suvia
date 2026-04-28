import { ChatOpenAI } from "@langchain/openai";

export type PatchableChatModel = {
  __stringifiedJsonResponsePatch?: boolean;
  completions: {
    completionWithRetry: (...args: unknown[]) => Promise<unknown>;
  };
  withConfig: (...args: unknown[]) => ChatOpenAI;
};

export const parseStringifiedJsonResponse = (data: unknown): unknown => {
  if (typeof data !== "string") {
    return data;
  }

  return JSON.parse(data);
};

export const patchStringifiedJsonResponses = <T extends ChatOpenAI>(
  chatModel: T
): T => {
  const patchedModel = chatModel as unknown as PatchableChatModel;

  if (patchedModel.__stringifiedJsonResponsePatch) {
    return chatModel;
  }

  const completions = patchedModel.completions;
  const originalCompletionWithRetry =
    completions.completionWithRetry.bind(completions);

  patchedModel.completions.completionWithRetry = async (...args) => {
    const data = await originalCompletionWithRetry(...args);
    return parseStringifiedJsonResponse(data);
  };

  const originalWithConfig = patchedModel.withConfig.bind(patchedModel);

  patchedModel.withConfig = (...args: unknown[]) => {
    return patchStringifiedJsonResponses(originalWithConfig(...args));
  };

  patchedModel.__stringifiedJsonResponsePatch = true;

  return chatModel;
};
