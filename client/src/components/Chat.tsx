import { useState } from "react";
import { Markdown } from "./Markdown";
import { useChatStream } from "../hooks/useChatStream";

export function Chat() {
  const [input, setInput] = useState("");
  const { messages, isSending, sendMessage, newChat } = useChatStream();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text || isSending) return;

    setInput("");
    await sendMessage(text);
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
        <button
          className="new-chat-button"
          type="button"
          onClick={newChat}
          disabled={isSending}
        >
          新建聊天
        </button>
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
