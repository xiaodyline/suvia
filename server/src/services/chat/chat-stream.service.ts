import type { SseWriter } from "../../utils/sse.util.ts";
import { logger } from "../../utils/logger.ts";
import { getMessageDebugFields } from "./chat-debug.ts";
import {
  extractAiMessageDelta,
  getMessageFromPayload,
} from "./chat-message-extractor.ts";
import { shouldForwardAiMessage } from "./chat-message-filter.ts";
import { getToolStatusMessage, logToolEvent } from "./chat-tool-status.ts";
import type { ChatStreamMode } from "./chat.types.ts";

type ProcessChatStreamOptions = {
  sseWriter: SseWriter;
  shouldStop: () => boolean;
  abort: () => void;
};

const isChatStreamMode = (value: string): value is ChatStreamMode => {
  return value === "messages" || value === "tools" || value === "values";
};

export const processChatStream = async (
  stream: AsyncIterable<unknown>,
  { sseWriter, shouldStop, abort }: ProcessChatStreamOptions
) => {
  let finalState: unknown;

  for await (const chunk of stream) {
    if (shouldStop() || !sseWriter.canWrite()) {
      abort();
      break;
    }

    if (!Array.isArray(chunk) || typeof chunk[0] !== "string") {
      continue;
    }

    const [mode, payload] = chunk;

    if (!isChatStreamMode(mode)) {
      continue;
    }

    if (mode === "messages" && Array.isArray(payload)) {
      const debugFields = getMessageDebugFields(payload);

      logger.debug("CHAT", "Message chunk metadata", debugFields);

      if (!shouldForwardAiMessage(payload)) {
        logger.debug("CHAT", "Skipped sub-agent message", debugFields);
        continue;
      }

      const message = getMessageFromPayload(payload);
      const delta = extractAiMessageDelta(message);

      if (delta) {
        logger.debug("CHAT", "Forwarded agent message", debugFields);
        sseWriter.text(delta);
      }
    }

    if (mode === "tools") {
      logToolEvent(payload);
      const statusMessage = getToolStatusMessage(payload);

      if (statusMessage) {
        sseWriter.status(statusMessage);
      }
    }

    if (mode === "values") {
      finalState = payload;
      logger.debug("CHAT", "Final state updated");
    }
  }

  return finalState;
};
