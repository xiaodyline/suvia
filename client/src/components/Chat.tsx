import { useState } from "react";
import { Markdown } from "./Markdown";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const API_URL = "http://localhost:3001/api/chat";

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

      const content = await response.text();
      setMessages((current) =>
        current.map((msg) =>
          msg.id === assistantMessage.id ? { ...msg, content } : msg
        )
      );
    } catch (error) {
      setMessages((current) =>
        current.map((msg) =>
          msg.id === assistantMessage.id
            ? {
              ...msg,
              content:
                error instanceof Error
                  ? error.message
                  : "请求失败：未知错误",
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
              <Markdown>{msg.content}</Markdown>
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