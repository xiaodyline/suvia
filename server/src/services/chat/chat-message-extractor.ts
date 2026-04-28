import { isRecord } from "../../utils/type-guards.ts";

export const extractTextFromContent = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (!isRecord(item)) {
        return "";
      }

      if (
        (item.type === "text" ||
          item.type === "output_text" ||
          item.type === undefined) &&
        typeof item.text === "string"
      ) {
        return item.text;
      }

      return "";
    })
    .join("");
};

export const getMessageFromPayload = (payload: unknown): unknown => {
  return Array.isArray(payload) ? payload[0] : undefined;
};

export const getMetadataFromPayload = (payload: unknown): unknown => {
  return Array.isArray(payload) ? payload[1] : undefined;
};

export const getMessageType = (message: unknown): string | undefined => {
  if (!isRecord(message)) {
    return undefined;
  }

  if (typeof message.type === "string") {
    return message.type;
  }

  if (typeof message._getType === "function") {
    const type = (message._getType as () => unknown)();
    return typeof type === "string" ? type : undefined;
  }

  return undefined;
};

export const getMessageName = (message: unknown): string | undefined => {
  if (!isRecord(message) || typeof message.name !== "string") {
    return undefined;
  }

  return message.name;
};

export const extractAiMessageDelta = (message: unknown): string => {
  if (!isRecord(message) || getMessageType(message) !== "ai") {
    return "";
  }

  return extractTextFromContent(message.content);
};

export const getLastMessage = (state: unknown): unknown => {
  if (!isRecord(state) || !Array.isArray(state.messages)) {
    return undefined;
  }

  return state.messages.at(-1);
};
