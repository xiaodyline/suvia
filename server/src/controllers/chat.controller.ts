import type Koa from "koa";
import { validateChatRequest } from "../services/chat/chat-request.validator.ts";
import { chatService } from "../services/chat/chat.service.ts";
import type { ChatMessage } from "../services/chat/chat.types.ts";
import { logger } from "../utils/logger.ts";

const getContentLength = (message: ChatMessage) => {
  return typeof message.content === "string" ? message.content.length : 0;
};

const handleChat: Koa.Middleware = async (ctx) => {
  const startedAt = Date.now();
  const validation = validateChatRequest(ctx.request.body);
  const requestLogFields = validation.ok
    ? {
        sessionId: validation.data.loggedSessionId,
        "messages.count": validation.data.messages.length,
      }
    : {
        sessionId: validation.loggedSessionId,
        "messages.count": validation.messages.length,
      };
  const lastRequestMessage = validation.ok
    ? validation.data.lastRequestMessage
    : validation.lastRequestMessage;
  const loggedSessionId = validation.ok
    ? validation.data.loggedSessionId
    : validation.loggedSessionId;

  logger.info("CHAT", "Request received", requestLogFields);
  logger.info("CHAT", `thread_id=${loggedSessionId}`);

  if (lastRequestMessage) {
    logger.info("CHAT", "lastMessage", {
      role: lastRequestMessage.role,
      length: getContentLength(lastRequestMessage),
    });
  }

  if (!validation.ok) {
    logger.warn(
      "CHAT",
      validation.reason === "messages"
        ? "Invalid request: messages is empty"
        : "Invalid request: sessionId is empty"
    );
    ctx.status = 400;
    ctx.body = { error: validation.error };
    return;
  }

  ctx.respond = false;

  try {
    await chatService.handleChat(validation.data, ctx.res, { startedAt });
  } catch (error) {
    ctx.respond = true;
    logger.error("CHAT", "Request failed", error, {
      sessionId: validation.data.loggedSessionId,
    });
    ctx.status = 503;
    ctx.body = {
      error:
        error instanceof Error ? error.message : "Agent is not initialized.",
    };
  }
};

export const chatController = {
  handleChat,
};
