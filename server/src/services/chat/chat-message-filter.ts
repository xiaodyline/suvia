import {
  getMessageFromPayload,
  getMessageName,
  getMessageType,
  getMetadataFromPayload,
} from "./chat-message-extractor.ts";
import { isRecord, type UnknownRecord } from "../../utils/type-guards.ts";

const SUBAGENT_MARKERS = [
  "subagent",
  "requirement_writer_agent",
  "image_agent",
];

export const getNestedMetadata = (
  metadata: unknown
): UnknownRecord | undefined => {
  if (!isRecord(metadata) || !isRecord(metadata.metadata)) {
    return undefined;
  }

  return metadata.metadata;
};

export const getStringField = (
  record: unknown,
  fieldName: string
): string | undefined => {
  if (!isRecord(record) || typeof record[fieldName] !== "string") {
    return undefined;
  }

  return record[fieldName];
};

export const getMetadataTags = (metadata: unknown): string[] => {
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

export const normalizeMarker = (value: string) => value.trim().toLowerCase();

export const compactMarker = (value: string) =>
  normalizeMarker(value).replace(/[^a-z0-9]/g, "");

export const isSubagentMarkerValue = (value: string) => {
  const normalizedValue = normalizeMarker(value);
  const compactValue = compactMarker(value);

  return SUBAGENT_MARKERS.some(
    (marker) =>
      normalizedValue === normalizeMarker(marker) ||
      compactValue === compactMarker(marker)
  );
};

export const includesSubagentMarker = (value: string) => {
  const normalizedValue = normalizeMarker(value);
  const compactValue = compactMarker(value);

  return SUBAGENT_MARKERS.some(
    (marker) =>
      normalizedValue.includes(normalizeMarker(marker)) ||
      compactValue.includes(compactMarker(marker))
  );
};

export const valueContainsSubagentMarker = (
  value: unknown,
  depth = 0
): boolean => {
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

export const shouldForwardAiMessage = (payload: unknown): boolean => {
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
    getStringField(metadata, "source") ??
    getStringField(nestedMetadata, "source");

  if (metadataSource !== undefined && isSubagentMarkerValue(metadataSource)) {
    return false;
  }

  const messageName = getMessageName(message);

  if (messageName !== undefined && isSubagentMarkerValue(messageName)) {
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
