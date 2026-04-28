import Router from "@koa/router";
import type { ServerResponse } from "node:http";
import { getAgent } from "../agents/index.ts";
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
  if (!isRecord(message) || getMessageType(message) !== "ai") {
    return "";
  }

  return extractTextFromContent(message.content);
};

const getMessageFromPayload = (payload: unknown): unknown => {
  return Array.isArray(payload) ? payload[0] : undefined;
};

const getMetadataFromPayload = (payload: unknown): unknown => {
  return Array.isArray(payload) ? payload[1] : undefined;
};

const getMessageType = (message: unknown): string | undefined => {
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

const getMessageName = (message: unknown): string | undefined => {
  if (!isRecord(message) || typeof message.name !== "string") {
    return undefined;
  }

  return message.name;
};

const getNestedMetadata = (metadata: unknown): UnknownRecord | undefined => {
  if (!isRecord(metadata) || !isRecord(metadata.metadata)) {
    return undefined;
  }

  return metadata.metadata;
};

const getStringField = (
  record: unknown,
  fieldName: string
): string | undefined => {
  if (!isRecord(record) || typeof record[fieldName] !== "string") {
    return undefined;
  }

  return record[fieldName];
};

const getMetadataTags = (metadata: unknown): string[] => {
  const directTags = isRecord(metadata) ? metadata.tags : undefined;
  const nestedMetadata = getNestedMetadata(metadata);
  const nestedTags = nestedMetadata?.tags;

  return [directTags, nestedTags].flatMap((tags) => {
    if (!Array.isArray(tags)) {
      return [];
    }

    return tags.filter((tag): tag is string => typeof tag === "string");
  });
};

const normalizeMarker = (value: string) => value.trim().toLowerCase();

const compactMarker = (value: string) =>
  normalizeMarker(value).replace(/[^a-z0-9]/g, "");

const SUBAGENT_MARKERS = ["subagent", "requirement_writer_agent", "image_agent"];

const isSubagentMarkerValue = (value: string) => {
  const normalizedValue = normalizeMarker(value);
  const compactValue = compactMarker(value);

  return SUBAGENT_MARKERS.some(
    (marker) =>
      normalizedValue === normalizeMarker(marker) ||
      compactValue === compactMarker(marker)
  );
};

const includesSubagentMarker = (value: string) => {
  const normalizedValue = normalizeMarker(value);
  const compactValue = compactMarker(value);

  return SUBAGENT_MARKERS.some((marker) =>
    normalizedValue.includes(normalizeMarker(marker)) ||
    compactValue.includes(compactMarker(marker))
  );
};

const valueContainsSubagentMarker = (value: unknown, depth = 0): boolean => {
  if (depth > 4 || value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return includesSubagentMarker(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => valueContainsSubagentMarker(item, depth + 1));
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).some((item) =>
    valueContainsSubagentMarker(item, depth + 1)
  );
};

const shouldForwardAiMessage = (payload: unknown): boolean => {
  const message = getMessageFromPayload(payload);

  if (getMessageType(message) !== "ai") {
    return true;
  }

  const metadata = getMetadataFromPayload(payload);
  const nestedMetadata = getNestedMetadata(metadata);
  const tags = getMetadataTags(metadata);

  if (tags.some((tag) => isSubagentMarkerValue(tag))) {
    return false;
  }

  const metadataSource =
    getStringField(metadata, "source") ?? getStringField(nestedMetadata, "source");

  if (
    metadataSource !== undefined &&
    isSubagentMarkerValue(metadataSource)
  ) {
    return false;
  }

  const messageName = getMessageName(message);

  if (
    messageName !== undefined &&
    isSubagentMarkerValue(messageName)
  ) {
    return false;
  }

  if (!isRecord(metadata)) {
    return true;
  }

  return ![
    metadata.langgraph_node,
    metadata.checkpoint_ns,
    metadata.langgraph_path,
  ].some((value) => valueContainsSubagentMarker(value));
};

const summarizeDebugValue = (value: unknown, depth = 0): unknown => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return `[array:${value.length}]`;
    }

    return value.slice(0, 8).map((item) => summarizeDebugValue(item, depth + 1));
  }

  if (!isRecord(value)) {
    return typeof value;
  }

  if (depth >= 2) {
    return `{keys:${Object.keys(value).join(",")}}`;
  }

  const safeKeys = ["source", "node", "name", "tags", "namespace", "checkpoint_ns"];
  const safeEntries = safeKeys
    .filter((key) => value[key] !== undefined)
    .map((key) => [key, summarizeDebugValue(value[key], depth + 1)] as const);

  if (safeEntries.length > 0) {
    return Object.fromEntries(safeEntries);
  }

  return `{keys:${Object.keys(value).join(",")}}`;
};

const getMessageDebugFields = (payload: unknown): UnknownRecord => {
  const message = getMessageFromPayload(payload);
  const metadata = getMetadataFromPayload(payload);

  return {
    "metadata.source": isRecord(metadata)
      ? summarizeDebugValue(
          metadata.source ?? getNestedMetadata(metadata)?.source
        )
      : undefined,
    "metadata.langgraph_node": isRecord(metadata)
      ? summarizeDebugValue(metadata.langgraph_node)
      : undefined,
    "metadata.langgraph_path": isRecord(metadata)
      ? summarizeDebugValue(metadata.langgraph_path)
      : undefined,
    "metadata.checkpoint_ns": isRecord(metadata)
      ? summarizeDebugValue(metadata.checkpoint_ns)
      : undefined,
    "metadata.tags": summarizeDebugValue(getMetadataTags(metadata)),
    "message.name": getMessageName(message),
    "message.type": getMessageType(message),
  };
};

const getToolStatusMessage = (payload: unknown): string | undefined => {
  if (!isRecord(payload) || typeof payload.name !== "string") {
    return undefined;
  }

  const toolName = payload.name;

  switch (payload.event) {
    case "on_tool_start":
      if (toolName === "requirement_writer_agent") {
        return "正在调用需求文档编写专家...";
      }

      if (toolName === "generate_srs_image") {
        return "正在生成插图...";
      }

      return `正在调用工具：${toolName}`;
    case "on_tool_end":
      if (toolName === "requirement_writer_agent") {
        return "需求文档编写专家已完成，正在整理结果...";
      }

      if (toolName === "generate_srs_image") {
        return "插图生成完成，正在整理文档...";
      }

      return `工具调用完成：${toolName}`;
    case "on_tool_error":
      if (toolName === "requirement_writer_agent") {
        return "需求文档编写专家执行失败";
      }

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
        const debugFields = getMessageDebugFields(payload);

        logger.debug("CHAT", "Message chunk metadata", debugFields);

        if (!shouldForwardAiMessage(payload)) {
          logger.debug("CHAT", "Skipped sub-agent message", debugFields);
          continue;
        }

        const message = getMessageFromPayload(payload);
        const delta = extractAiMessageDelta(message);

        if (delta) {
          logger.debug("CHAT", "Forwarded agent message", debugFields);
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
