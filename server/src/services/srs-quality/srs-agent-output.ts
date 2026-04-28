type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null;
};

const extractTextFromContent = (content: unknown): string => {
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

const extractTextFromMessage = (message: unknown): string => {
  if (!isRecord(message)) {
    return "";
  }

  const directContent = extractTextFromContent(message.content);

  if (directContent) {
    return directContent;
  }

  const kwargs = isRecord(message.kwargs) ? message.kwargs : undefined;
  return extractTextFromContent(kwargs?.content);
};

export const extractFinalTextFromAgentResult = (result: unknown): string => {
  if (isRecord(result) && Array.isArray(result.messages)) {
    for (let index = result.messages.length - 1; index >= 0; index -= 1) {
      const text = extractTextFromMessage(result.messages[index]).trim();

      if (text) {
        return text;
      }
    }
  }

  return extractTextFromMessage(result).trim();
};
