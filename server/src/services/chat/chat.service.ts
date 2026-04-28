import type { ServerResponse } from "node:http";
import { getAgent } from "../../agents/index.ts";
import { JsonFileUtil } from "../../utils/json-file.util.ts";
import { logger } from "../../utils/logger.ts";
import { createSseWriter, setupSseHeaders } from "../../utils/sse.util.ts";
import { getLastMessage } from "./chat-message-extractor.ts";
import { processChatStream } from "./chat-stream.service.ts";
import type { ChatStreamMode, ValidatedChatRequest } from "./chat.types.ts";

type HandleChatOptions = {
  startedAt?: number;
};

const CHAT_STREAM_MODE: ChatStreamMode[] = ["messages", "tools", "values"];

const handleChat = async (
  request: ValidatedChatRequest,
  res: ServerResponse,
  options?: HandleChatOptions
) => {
  const startedAt = options?.startedAt ?? Date.now();
  const activeAgent = getAgent();
  const abortController = new AbortController();
  const sseWriter = createSseWriter(res);
  let clientClosed = false;
  let finalState: unknown;

  setupSseHeaders(res);

  res.on("close", () => {
    if (!res.writableEnded) {
      clientClosed = true;
      logger.warn("CHAT", "Client closed connection");
      logger.warn("CHAT", "Request aborted", {
        sessionId: request.loggedSessionId,
      });
      abortController.abort();
    }
  });

  try {
    logger.info("CHAT", "Agent stream started", {
      streamMode: "messages,tools,values",
    });

    const stream = await activeAgent.stream(
      { messages: request.messages },
      {
        streamMode: CHAT_STREAM_MODE,
        configurable: {
          thread_id: request.sessionId,
        },
        signal: abortController.signal,
      }
    );

    finalState = await processChatStream(stream as AsyncIterable<unknown>, {
      sseWriter,
      shouldStop: () => clientClosed || !sseWriter.canWrite(),
      abort: () => abortController.abort(),
    });

    if (!clientClosed) {
      logger.info("CHAT", "Agent stream completed", {
        "finalState.received": finalState !== undefined,
      });
    }

    const lastMessage = getLastMessage(finalState);

    if (lastMessage !== undefined) {
      await JsonFileUtil.writeJson("lastMessage.json", lastMessage, {
        dir: "logs",
      });
    }

    sseWriter.done();
  } catch (error) {
    if (!clientClosed && !abortController.signal.aborted) {
      logger.error("CHAT", "Request failed", error, {
        sessionId: request.loggedSessionId,
      });
      sseWriter.error(
        error instanceof Error ? error.message : "流式响应失败：未知错误"
      );
    }
  } finally {
    if (!clientClosed) {
      logger.info("CHAT", "Request completed", {
        duration: `${Date.now() - startedAt}ms`,
        sessionId: request.loggedSessionId,
      });
    }

    sseWriter.end();
  }
};

export const chatService = {
  handleChat,
};
