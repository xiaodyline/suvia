import { isRecord, type UnknownRecord } from "../../utils/type-guards.ts";
import {
  getMessageFromPayload,
  getMessageName,
  getMessageType,
  getMetadataFromPayload,
} from "./chat-message-extractor.ts";
import { getMetadataTags, getNestedMetadata } from "./chat-message-filter.ts";

export const summarizeDebugValue = (value: unknown, depth = 0): unknown => {
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

    return value
      .slice(0, 8)
      .map((item) => summarizeDebugValue(item, depth + 1));
  }

  if (!isRecord(value)) {
    return typeof value;
  }

  if (depth >= 2) {
    return `{keys:${Object.keys(value).join(",")}}`;
  }

  const safeKeys = [
    "source",
    "node",
    "name",
    "tags",
    "namespace",
    "checkpoint_ns",
  ];
  const safeEntries = safeKeys
    .filter((key) => value[key] !== undefined)
    .map((key) => [key, summarizeDebugValue(value[key], depth + 1)] as const);

  if (safeEntries.length > 0) {
    return Object.fromEntries(safeEntries);
  }

  return `{keys:${Object.keys(value).join(",")}}`;
};

export const getMessageDebugFields = (payload: unknown): UnknownRecord => {
  const message = getMessageFromPayload(payload);
  const metadata = getMetadataFromPayload(payload);

  return {
    "metadata.source": isRecord(metadata)
      ? summarizeDebugValue(metadata.source ?? getNestedMetadata(metadata)?.source)
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
