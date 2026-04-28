import Router from "@koa/router";
import type { ServerResponse } from "node:http";
import { getAgent } from "../agents/agents.ts";
import { JsonFileUtil } from "../utils/json-file.util.ts";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  messages?: ChatMessage[];
  sessionId?: string;
};

const apiRouter = new Router({
  prefix: "/api",
});

type SseEventName = "text" | "status" | "done" | "error";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null;
};

const canWrite = (res: ServerResponse) => {
  return !res.destroyed && !res.writableEnded;
};

const writeSseEvent = (
  res: ServerResponse,
  event: SseEventName,
  data: unknown
) => {
  if (!canWrite(res)) {
    return false;
  }

  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  return true;
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

const extractAiMessageDelta = (message: unknown): string => {
  if (!isRecord(message) || message.type !== "ai") {
    return "";
  }

  return extractTextFromContent(message.content);
};

const getToolStatusMessage = (payload: unknown): string | undefined => {
  if (!isRecord(payload) || typeof payload.name !== "string") {
    return undefined;
  }

  const toolName = payload.name;

  switch (payload.event) {
    case "on_tool_start":
      return toolName === "generate_srs_image"
        ? "正在生成插图..."
        : `正在调用工具：${toolName}`;
    case "on_tool_end":
      return toolName === "generate_srs_image"
        ? "插图生成完成，正在整理文档..."
        : `工具调用完成：${toolName}`;
    case "on_tool_error":
      return `工具调用失败：${toolName}`;
    default:
      return undefined;
  }
};

const getLastMessage = (state: unknown): unknown => {
  if (!isRecord(state) || !Array.isArray(state.messages)) {
    return undefined;
  }

  return state.messages.at(-1);
};

apiRouter.post("/chat", async (ctx) => {
  const body = ctx.request.body as ChatRequestBody;
  const messages = body.messages ?? [];
  const sessionId = body.sessionId?.trim();

  if (messages.length === 0) {
    ctx.status = 400;
    ctx.body = { error: "messages 不能为空" };
    return;
  }

  if (!sessionId) {
    ctx.status = 400;
    ctx.body = { error: "sessionId 不能为空" };
    return;
  }

  let activeAgent: ReturnType<typeof getAgent>;

  try {
    activeAgent = getAgent();
  } catch (error) {
    ctx.status = 503;
    ctx.body = {
      error: error instanceof Error ? error.message : "Agent is not initialized.",
    };
    return;
  }

  const abortController = new AbortController();
  const res = ctx.res;
  let clientClosed = false;
  let finalState: unknown;

  ctx.respond = false;
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  res.on("close", () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
    }
  });

  try {
    const stream = await activeAgent.stream(
      { messages },
      {
        streamMode: ["messages", "tools", "values"],
        configurable: {
          thread_id: sessionId,
        },
        signal: abortController.signal,
      }
    );

    for await (const chunk of stream as AsyncIterable<unknown>) {
      if (clientClosed || !canWrite(res)) {
        abortController.abort();
        break;
      }

      if (!Array.isArray(chunk) || typeof chunk[0] !== "string") {
        continue;
      }

      const [mode, payload] = chunk;

      if (mode === "messages" && Array.isArray(payload)) {
        const delta = extractAiMessageDelta(payload[0]);

        if (delta) {
          writeSseEvent(res, "text", { delta });
        }
      }

      if (mode === "tools") {
        const statusMessage = getToolStatusMessage(payload);

        if (statusMessage) {
          writeSseEvent(res, "status", { message: statusMessage });
        }
      }

      if (mode === "values") {
        finalState = payload;
      }
    }

    const lastMessage = getLastMessage(finalState);

    if (lastMessage !== undefined) {
      await JsonFileUtil.writeJson("lastMessage.json", lastMessage, {
        dir: "logs",
      });
    }

    writeSseEvent(res, "done", {});
  } catch (error) {
    if (!clientClosed && !abortController.signal.aborted) {
      writeSseEvent(res, "error", {
        message:
          error instanceof Error ? error.message : "流式响应失败：未知错误",
      });
    }
  } finally {
    if (canWrite(res)) {
      res.end();
    }
  }
});

export default apiRouter;
