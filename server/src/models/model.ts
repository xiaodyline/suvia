import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";

// 模块被导入时，统一加载一次模型配置。
dotenv.config();

const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in server/.env");
}

type PatchableChatModel = {
  __stringifiedJsonResponsePatch?: boolean;
  completions: {
    completionWithRetry: (...args: any[]) => Promise<any>;
  };
  withConfig: (...args: any[]) => any;
};

const parseStringifiedJsonResponse = (data: unknown): unknown => {
  if (typeof data !== "string") {
    return data;
  }

  // 有些 OpenAI 兼容网关会把 JSON 响应再包成字符串返回。
  // LangChain 需要拿到对象，否则会读不到 choices[0].message。
  return JSON.parse(data);
};

const patchStringifiedJsonResponses = <T extends ChatOpenAI>(chatModel: T): T => {
  const patchedModel = chatModel as unknown as PatchableChatModel;

  if (patchedModel.__stringifiedJsonResponsePatch) {
    return chatModel;
  }

  const completions = patchedModel.completions;
  const originalCompletionWithRetry = completions.completionWithRetry.bind(completions);

  // 在 LangChain 把原始响应转换成 generations 前，先把响应格式归一化。
  completions.completionWithRetry = async (...args) => {
    const data = await originalCompletionWithRetry(...args);
    return parseStringifiedJsonResponse(data);
  };

  const originalWithConfig = patchedModel.withConfig.bind(patchedModel);

  // Agent 内部可能会通过 withConfig() 克隆模型，克隆出来的实例也要继续保留补丁。
  patchedModel.withConfig = (...args: any[]) => {
    return patchStringifiedJsonResponses(originalWithConfig(...args));
  };

  patchedModel.__stringifiedJsonResponsePatch = true;

  return chatModel;
};

export const createChatModel = () => {
  const model = new ChatOpenAI({
    model: OPENAI_MODEL,
    apiKey: OPENAI_API_KEY,
    maxRetries: 5,
    streamUsage: false,
    useResponsesApi: true, // OpenAI 兼容网关会返回 responses API 格式的响应。 用这个接口能不需要做额外的处理
    configuration: {
      baseURL: OPENAI_API_URL,
    },
  });
  return model;
  // return patchStringifiedJsonResponses(model);
};

export const model = createChatModel();
