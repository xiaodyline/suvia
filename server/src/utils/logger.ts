export type LogScope =
  | "BOOT"
  | "CONFIG"
  | "CHECKPOINT"
  | "AGENT"
  | "SERVER"
  | "CHAT"
  | "FILES"
  | "RAG"
  | "TOOL"
  | "QUALITY";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;
type SanitizedValue =
  | string
  | number
  | boolean
  | SanitizedValue[]
  | { [key: string]: SanitizedValue };

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LOG_LEVEL: LogLevel = "info";
const MAX_LOG_STRING_LENGTH = 300;

const SENSITIVE_EXACT_KEYS = new Set([
  "embedding",
  "embeddings",
  "queryembedding",
  "vector",
  "vectors",
  "queryvector",
  "buffer",
  "buffers",
  "content",
  "contents",
  "text",
  "texts",
]);

const isLogLevel = (value: string): value is LogLevel => {
  return value in LOG_LEVELS;
};

export const getLogLevel = (): LogLevel => {
  const rawLevel = process.env.LOG_LEVEL?.trim().toLowerCase();

  if (!rawLevel) {
    return DEFAULT_LOG_LEVEL;
  }

  return isLogLevel(rawLevel) ? rawLevel : DEFAULT_LOG_LEVEL;
};

const shouldLog = (level: LogLevel) => {
  return LOG_LEVELS[level] >= LOG_LEVELS[getLogLevel()];
};

const normalizeLogKey = (key: string) => {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
};

const isSensitiveLogKey = (key: string) => {
  const normalizedKey = normalizeLogKey(key);

  if (SENSITIVE_EXACT_KEYS.has(normalizedKey)) {
    return true;
  }

  return (
    normalizedKey.includes("password") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("token") ||
    normalizedKey.includes("authorization") ||
    normalizedKey.includes("apikey") ||
    normalizedKey.includes("accesskey")
  );
};

const truncateString = (value: string) => {
  if (value.length <= MAX_LOG_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_LOG_STRING_LENGTH - 3)}...`;
};

const maskSensitiveTermsInText = (value: string) => {
  return value.replace(
    /\b(?:OSS_ACCESS_KEY_ID|OSS_ACCESS_KEY_SECRET|EMBEDDING_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|MODEL_API_KEY)\b/gi,
    "[filtered]"
  );
};

const sanitizeString = (value: string) => {
  return truncateString(maskSensitiveTermsInText(maskDatabaseUrlsInText(value)));
};

const sanitizeFieldValue = (
  key: string,
  value: unknown
): SanitizedValue | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (isSensitiveLogKey(key)) {
    return undefined;
  }

  if (value instanceof Error) {
    return sanitizeString(value.message);
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => sanitizeFieldValue(String(index), item))
      .filter((item): item is SanitizedValue => item !== undefined);
  }

  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const sanitizedEntries = Object.entries(value as LogFields)
      .map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeFieldValue(entryKey, entryValue),
      ] as const)
      .filter((entry): entry is readonly [string, SanitizedValue] => {
        return entry[1] !== undefined;
      });

    return Object.fromEntries(sanitizedEntries) as { [key: string]: SanitizedValue };
  }

  return sanitizeString(JSON.stringify(value));
};

const formatValue = (value: SanitizedValue): string => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
};

export const formatLogMeta = (fields?: LogFields) => {
  if (!fields) {
    return "";
  }

  return Object.entries(fields)
    .map(([key, value]) => {
      const sanitizedValue = sanitizeFieldValue(key, value);
      return sanitizedValue === undefined
        ? undefined
        : `${key}=${formatValue(sanitizedValue)}`;
    })
    .filter((field): field is string => field !== undefined)
    .join(" ");
};

const normalizeErrorAndFields = (
  errorOrFields?: unknown,
  fields?: LogFields
): LogFields | undefined => {
  if (errorOrFields instanceof Error) {
    return {
      ...fields,
      error: errorOrFields.message,
    };
  }

  if (errorOrFields && typeof errorOrFields === "object") {
    return {
      ...(errorOrFields as LogFields),
      ...fields,
    };
  }

  if (errorOrFields !== undefined) {
    return {
      ...fields,
      error: errorOrFields,
    };
  }

  return fields;
};

const writeLog = (level: LogLevel, scope: LogScope, message: string, fields?: LogFields) => {
  if (!shouldLog(level)) {
    return;
  }

  const formattedFields = formatLogMeta(fields);
  const line = formattedFields
    ? `[${scope}] ${message} ${formattedFields}`
    : `[${scope}] ${message}`;

  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "info":
      console.info(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }
};

const isLikelyDatabaseUrl = (value: string) => {
  return /^(postgresql|postgres|mysql):\/\//i.test(value);
};

const maskDatabaseUrlsInText = (value: string) => {
  return value.replace(/\b(?:postgresql|postgres|mysql):\/\/[^\s]+/gi, (match) =>
    maskDatabaseUrl(match)
  );
};

export const maskDatabaseUrl = (value: string) => {
  try {
    const url = new URL(value);

    if (!isLikelyDatabaseUrl(value)) {
      return value;
    }

    if (url.password) {
      url.password = "******";
    }

    return url.toString();
  } catch {
    return value.replace(
      /^((?:postgresql|postgres|mysql):\/\/[^:\s/@]+):([^@\s]+)@/i,
      "$1:******@"
    );
  }
};

export type PostgresConnectionDescription = {
  host: string;
  port: string;
  database: string;
  user: string;
};

export const describePostgresConnection = (
  value: string
): PostgresConnectionDescription | undefined => {
  try {
    const url = new URL(value);
    const database = url.pathname.replace(/^\//, "") || "unknown";

    return {
      host: url.hostname || "unknown",
      port: url.port || "5432",
      database,
      user: decodeURIComponent(url.username || "unknown"),
    };
  } catch {
    return undefined;
  }
};

export const logger = {
  debug: (scope: LogScope, message: string, fields?: LogFields) => {
    writeLog("debug", scope, message, fields);
  },
  info: (scope: LogScope, message: string, fields?: LogFields) => {
    writeLog("info", scope, message, fields);
  },
  warn: (scope: LogScope, message: string, fields?: LogFields) => {
    writeLog("warn", scope, message, fields);
  },
  error: (
    scope: LogScope,
    message: string,
    errorOrFields?: unknown,
    fields?: LogFields
  ) => {
    writeLog("error", scope, message, normalizeErrorAndFields(errorOrFields, fields));
  },
};
