import { useState } from "react";
import { streamChat } from "../services/chatApi";
import type { ChatRequestMessage, ChatRole } from "../services/chatApi";

export type ChatMessage = {
  id: string;
  role: Exclude<ChatRole, "system">;
  content: string;
  status?: string;
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "请求失败：未知错误";
};

const toChatRequestMessages = (messages: ChatMessage[]): ChatRequestMessage[] => {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
};

const appendAssistantContent = (
  messages: ChatMessage[],
  assistantId: string,
  delta: string
) => {
  return messages.map((message) =>
    message.id === assistantId
      ? { ...message, content: `${message.content}${delta}`, status: undefined }
      : message
  );
};

const updateAssistantStatus = (
  messages: ChatMessage[],
  assistantId: string,
  status: string | undefined
) => {
  return messages.map((message) =>
    message.id === assistantId ? { ...message, status } : message
  );
};

const appendAssistantError = (
  messages: ChatMessage[],
  assistantId: string,
  errorMessage: string
) => {
  return messages.map((message) =>
    message.id === assistantId
      ? {
          ...message,
          content: message.content
            ? `${message.content}\n\n${errorMessage}`
            : errorMessage,
          status: undefined,
        }
      : message
  );
};

export const useChatStream = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async (input: string) => {
    const text = input.trim();

    if (!text || isSending) {
      return;
    }

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

    const requestMessages = toChatRequestMessages([...messages, userMessage]);
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setIsSending(true);

    try {
      await streamChat({
        messages: requestMessages,
        onText: (delta) => {
          setMessages((current) =>
            appendAssistantContent(current, assistantMessage.id, delta)
          );
        },
        onStatus: (status) => {
          setMessages((current) =>
            updateAssistantStatus(current, assistantMessage.id, status)
          );
        },
        onDone: () => {
          setMessages((current) =>
            updateAssistantStatus(current, assistantMessage.id, undefined)
          );
        },
        onError: (message) => {
          setMessages((current) =>
            appendAssistantError(current, assistantMessage.id, message)
          );
        },
      });

      setMessages((current) =>
        updateAssistantStatus(current, assistantMessage.id, undefined)
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      setMessages((current) =>
        appendAssistantError(current, assistantMessage.id, errorMessage)
      );
    } finally {
      setIsSending(false);
    }
  };

  return {
    messages,
    isSending,
    sendMessage,
  };
};
