import Router from "@koa/router";
import type { ServerResponse } from "node:http";
import { getAgent } from "../agents/agents.ts";
import { JsonFileUtil } from "../utils/json-file.util.ts";
import { logger } from "../utils/logger.ts";

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

const logToolEvent = (payload: unknown) => {
  if (!isRecord(payload) || typeof payload.name !== "string") {
    return;
  }

  switch (payload.event) {
    case "on_tool_start":
      logger.info("TOOL", `${payload.name} started`);
      break;
    case "on_tool_end":
      logger.info("TOOL", `${payload.name} completed`);
      break;
    case "on_tool_error":
      logger.error("TOOL", `${payload.name} failed`);
      break;
  }
};

const getLastMessage = (state: unknown): unknown => {
  if (!isRecord(state) || !Array.isArray(state.messages)) {
    return undefined;
  }

  return state.messages.at(-1);
};

apiRouter.post("/chat", async (ctx) => {
  const startedAt = Date.now();
  const body = ctx.request.body as ChatRequestBody;
  const messages = body.messages ?? [];
  const sessionId = body.sessionId?.trim();
  const lastRequestMessage = messages.at(-1);
  const loggedSessionId = sessionId || "empty";

  logger.info("CHAT", "Request received", {
    sessionId: loggedSessionId,
    "messages.count": messages.length,
  });
  logger.info("CHAT", `thread_id=${loggedSessionId}`);

  if (lastRequestMessage) {
    logger.info("CHAT", "lastMessage", {
      role: lastRequestMessage.role,
      length:
        typeof lastRequestMessage.content === "string"
          ? lastRequestMessage.content.length
          : 0,
    });
  }

  if (messages.length === 0) {
    logger.warn("CHAT", "Invalid request: messages is empty");
    ctx.status = 400;
    ctx.body = { error: "messages 不能为空" };
    return;
  }

  if (!sessionId) {
    logger.warn("CHAT", "Invalid request: sessionId is empty");
    ctx.status = 400;
    ctx.body = { error: "sessionId 不能为空" };
    return;
  }

  let activeAgent: ReturnType<typeof getAgent>;

  try {
    activeAgent = getAgent();
  } catch (error) {
    logger.error("CHAT", "Request failed", error, { sessionId: loggedSessionId });
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
      logger.warn("CHAT", "Client closed connection");
      logger.warn("CHAT", "Request aborted", { sessionId: loggedSessionId });
      abortController.abort();
    }
  });

  try {
    logger.info("CHAT", "Agent stream started", {
      streamMode: "messages,tools,values",
    });

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
        logToolEvent(payload);
        const statusMessage = getToolStatusMessage(payload);

        if (statusMessage) {
          writeSseEvent(res, "status", { message: statusMessage });
        }
      }

      if (mode === "values") {
        finalState = payload;
        logger.debug("CHAT", "Final state updated");
      }
    }

    if (!clientClosed) {
      logger.info("CHAT", "Agent stream completed", {
        "finalState.received": finalState !== undefined,
      });
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
      logger.error("CHAT", "Request failed", error, { sessionId: loggedSessionId });
      writeSseEvent(res, "error", {
        message:
          error instanceof Error ? error.message : "流式响应失败：未知错误",
      });
    }
  } finally {
    if (!clientClosed) {
      logger.info("CHAT", "Request completed", {
        duration: `${Date.now() - startedAt}ms`,
        sessionId: loggedSessionId,
      });
    }

    if (canWrite(res)) {
      res.end();
    }
  }
});

export default apiRouter;
