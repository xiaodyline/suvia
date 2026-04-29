import type { ServerResponse } from "node:http";
import { getAgent } from "../../agents/index.ts";
import { logger } from "../../utils/logger.ts";
import { MessageContentUtil } from "../../utils/message-content.util.ts";
import { createSseWriter, setupSseHeaders } from "../../utils/sse.util.ts";
import { srsQualityResultStore } from "../srs-quality/srs-quality-result.store.ts";
import { getLastMessage, getMessagesFromState } from "./chat-message-extractor.ts";
import { saveSessionMessages } from "./chat-session-messages.store.ts";
import { processChatStream } from "./chat-stream.service.ts";
import type { ChatStreamMode, ValidatedChatRequest } from "./chat.types.ts";

type HandleChatOptions = {
  startedAt?: number;
};

const CHAT_STREAM_MODE: ChatStreamMode[] = ["messages", "tools", "values"];
const CHAT_IMAGE_OSS_DIR = "chat-images";

const emitFinalImageContent = async (
  finalState: unknown,
  sseWriter: ReturnType<typeof createSseWriter>
) => {
  const lastMessage = getLastMessage(finalState);

  if (lastMessage === undefined) {
    return;
  }

  const processedContent = await MessageContentUtil.processLastMessage(lastMessage, {
    ossDir: CHAT_IMAGE_OSS_DIR,
  });
  const imageItems = processedContent.items.filter(
    (item) => item.type === "image" && item.responseText
  );

  if (imageItems.length === 0) {
    return;
  }

  const hasTextContent = processedContent.items.some(
    (item) => item.type === "text" && item.responseText.trim()
  );
  const imageMarkdown = imageItems.map((item) => item.responseText).join("\n\n");
  const delta = hasTextContent ? `\n\n${imageMarkdown}` : imageMarkdown;

  logger.info("CHAT", "Final image content emitted", {
    "images.count": imageItems.length,
  });
  sseWriter.text(delta);
};

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

    const finalMessages = getMessagesFromState(finalState);

    if (finalMessages !== undefined) {
      await saveSessionMessages(request.sessionId, finalMessages);
    } else {
      logger.debug("CHAT", "No final messages found in finalState", {
        sessionId: request.loggedSessionId,
      });
    }

    if (!clientClosed && sseWriter.canWrite()) {
      await emitFinalImageContent(finalState, sseWriter);
    }

    const qualityResult = srsQualityResultStore.take(request.sessionId);

    if (qualityResult) {
      sseWriter.quality(qualityResult);
    }

    sseWriter.done();
  } catch (error) {
    srsQualityResultStore.delete(request.sessionId);

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
