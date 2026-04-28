export type LogScope =
  | "BOOT"
  | "CONFIG"
  | "CHECKPOINT"
  | "AGENT"
  | "SERVER"
  | "CHAT"
  | "TOOL"
  | "QUALITY";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LOG_LEVEL: LogLevel = "info";

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

const sanitizeFieldValue = (key: string, value: unknown): unknown => {
  const normalizedKey = key.toLowerCase();

  if (
    normalizedKey.includes("password") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("token")
  ) {
    return value ? "configured" : "not_configured";
  }

  if (normalizedKey.includes("api_key") || normalizedKey.includes("apikey")) {
    return value ? "configured" : "not_configured";
  }

  if (typeof value === "string") {
    return maskDatabaseUrlsInText(value);
  }

  return value;
};

const formatValue = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  return JSON.stringify(value);
};

const formatFields = (fields?: LogFields) => {
  if (!fields) {
    return "";
  }

  return Object.entries(fields)
    .map(([key, value]) => `${key}=${formatValue(sanitizeFieldValue(key, value))}`)
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

  const formattedFields = formatFields(fields);
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
