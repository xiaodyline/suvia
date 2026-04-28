export type SseMessage = {
  event: string;
  data: string;
};

export type SseStreamHandlers = {
  onText: (delta: string) => void;
  onStatus: (message: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

const parseSseBlock = (block: string): SseMessage | undefined => {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const value =
      separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).replace(/^ /, "");

    if (field === "event") {
      event = value;
    }

    if (field === "data") {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return undefined;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
};

const parseSsePayload = (message: SseMessage): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(message.data);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

export const readSseStream = async (
  stream: ReadableStream<Uint8Array>,
  handlers: SseStreamHandlers
) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let shouldStop = false;

  const handleMessage = (message: SseMessage) => {
    const payload = parseSsePayload(message);

    if (message.event === "text" && typeof payload.delta === "string") {
      handlers.onText(payload.delta);
    }

    if (message.event === "status" && typeof payload.message === "string") {
      handlers.onStatus(payload.message);
    }

    if (message.event === "done") {
      shouldStop = true;
      handlers.onDone();
    }

    if (message.event === "error") {
      shouldStop = true;
      handlers.onError(
        typeof payload.message === "string" ? payload.message : "请求失败：未知错误"
      );
    }
  };

  try {
    while (!shouldStop) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const message = parseSseBlock(block);

        if (message) {
          handleMessage(message);
        }

        if (shouldStop) {
          break;
        }
      }
    }

    buffer += decoder.decode();

    if (!shouldStop && buffer.trim()) {
      const message = parseSseBlock(buffer);

      if (message) {
        handleMessage(message);
      }
    }
  } finally {
    if (shouldStop) {
      await reader.cancel().catch(() => undefined);
    }
  }
};
