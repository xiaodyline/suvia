import { isRecord } from "../../utils/type-guards.ts";
import type { ChatMessage, ValidatedChatRequest } from "./chat.types.ts";

type ChatValidationFailureReason = "messages" | "sessionId";

export type ChatValidationResult =
  | {
      ok: true;
      data: ValidatedChatRequest;
    }
  | {
      ok: false;
      error: string;
      reason: ChatValidationFailureReason;
      messages: ChatMessage[];
      sessionId: string | undefined;
      lastRequestMessage: ChatMessage | undefined;
      loggedSessionId: string;
    };

const getMessages = (body: unknown): ChatMessage[] => {
  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return [];
  }

  return body.messages as ChatMessage[];
};

const getSessionId = (body: unknown): string | undefined => {
  if (!isRecord(body) || typeof body.sessionId !== "string") {
    return undefined;
  }

  const sessionId = body.sessionId.trim();
  return sessionId || undefined;
};

export const validateChatRequest = (body: unknown): ChatValidationResult => {
  const messages = getMessages(body);
  const sessionId = getSessionId(body);
  const lastRequestMessage = messages.at(-1);
  const loggedSessionId = sessionId || "empty";

  if (messages.length === 0) {
    return {
      ok: false,
      error: "messages 不能为空",
      reason: "messages",
      messages,
      sessionId,
      lastRequestMessage,
      loggedSessionId,
    };
  }

  if (!sessionId) {
    return {
      ok: false,
      error: "sessionId 不能为空",
      reason: "sessionId",
      messages,
      sessionId,
      lastRequestMessage,
      loggedSessionId,
    };
  }

  return {
    ok: true,
    data: {
      messages,
      sessionId,
      lastRequestMessage,
      loggedSessionId,
    },
  };
};
