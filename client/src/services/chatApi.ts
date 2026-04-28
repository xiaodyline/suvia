import { request } from "./request";
import { readSseStream } from "../utils/sseStream";
import type { SseStreamHandlers } from "../utils/sseStream";

export type ChatRole = "system" | "user" | "assistant";

export type ChatRequestMessage = {
  role: ChatRole;
  content: string;
};

export type StreamChatOptions = SseStreamHandlers & {
  sessionId: string;
  messages: ChatRequestMessage[];
  signal?: AbortSignal;
};

export const streamChat = async ({
  sessionId,
  messages,
  signal,
  onText,
  onStatus,
  onDone,
  onError,
}: StreamChatOptions) => {
  const response = await request("/api/chat", {
    method: "POST",
    body: { sessionId, messages },
    signal,
  });

  if (!response.body) {
    throw new Error("当前浏览器不支持流式响应");
  }

  await readSseStream(response.body, {
    onText,
    onStatus,
    onDone,
    onError,
  });
};
