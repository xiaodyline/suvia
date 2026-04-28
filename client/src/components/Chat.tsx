import { useState } from "react";
import { Markdown } from "./Markdown";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
};

const API_URL = "http://localhost:3001/api/chat";

type SseMessage = {
  event: string;
  data: string;
};

type ChatStreamHandlers = {
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

const readChatStream = async (
  stream: ReadableStream<Uint8Array>,
  handlers: ChatStreamHandlers
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
      handlers.onDone();
      shouldStop = true;
    }

    if (message.event === "error") {
      handlers.onError(
        typeof payload.message === "string" ? payload.message : "请求失败：未知错误"
      );
      shouldStop = true;
    }
  };

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

  if (shouldStop) {
    await reader.cancel().catch(() => undefined);
  }
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "请求失败：未知错误";
};

export function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text || isSending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      status: "正在思考...",
    };

    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(`请求失败：${response.status}`);
      }

      if (!response.body) {
        throw new Error("当前浏览器不支持流式响应");
      }

      await readChatStream(response.body, {
        onText: (delta) => {
          setMessages((current) =>
            current.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: `${msg.content}${delta}`, status: undefined }
                : msg
            )
          );
        },
        onStatus: (status) => {
          setMessages((current) =>
            current.map((msg) =>
              msg.id === assistantMessage.id ? { ...msg, status } : msg
            )
          );
        },
        onDone: () => {
          setMessages((current) =>
            current.map((msg) =>
              msg.id === assistantMessage.id ? { ...msg, status: undefined } : msg
            )
          );
        },
        onError: (message) => {
          throw new Error(message);
        },
      });

      setMessages((current) =>
        current.map((msg) =>
          msg.id === assistantMessage.id ? { ...msg, status: undefined } : msg
        )
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      setMessages((current) =>
        current.map((msg) =>
          msg.id === assistantMessage.id
            ? {
              ...msg,
              content: msg.content ? `${msg.content}\n\n${errorMessage}` : errorMessage,
              status: undefined,
            }
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }

  }

  return (
    <main className="chat-shell">
      <section className="message-list">
        {messages.map((msg) =>
          msg.role === "assistant" ? (
            <article className="message message-ai" key={msg.id}>
              {msg.content ? <Markdown>{msg.content}</Markdown> : null}
              {msg.status ? <div className="message-status">{msg.status}</div> : null}
            </article>
          ) : (
            <article className="message message-human" key={msg.id}>
              {msg.content}
            </article>
          )
        )}
      </section>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="输入消息..."
          rows={3}
        />
        <button type="submit" disabled={!input.trim() || isSending}>
          {isSending ? "发送中" : "发送"}
        </button>
      </form>
    </main>
  );


}
