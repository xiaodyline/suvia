export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequestBody = {
  messages?: ChatMessage[];
  sessionId?: string;
};

export type ValidatedChatRequest = {
  messages: ChatMessage[];
  sessionId: string;
  lastRequestMessage?: ChatMessage;
  loggedSessionId: string;
};

export type SseEventName = "text" | "status" | "done" | "error" | "quality";

export type ChatStreamMode = "messages" | "tools" | "values";
