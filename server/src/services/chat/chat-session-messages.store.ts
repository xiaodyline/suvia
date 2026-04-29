import path from "node:path";
import { JsonFileUtil } from "../../utils/json-file.util.ts";
import { logger } from "../../utils/logger.ts";

const SESSION_LOG_DIR = path.join("logs", "sessions");

export const sanitizeSessionIdForFilename = (sessionId: string): string => {
  const safeSessionId = sessionId.replace(/[^A-Za-z0-9_-]/g, "_");

  return safeSessionId.length > 0 ? safeSessionId : "unknown-session";
};

export const saveSessionMessages = async (
  sessionId: string,
  messages: unknown[]
): Promise<void> => {
  const safeSessionId = sanitizeSessionIdForFilename(sessionId);
  const fileName = `${safeSessionId}.json`;
  const logFilePath = `logs/sessions/${fileName}`;

  try {
    await JsonFileUtil.writeJson(
      fileName,
      {
        sessionId,
        updatedAt: new Date().toISOString(),
        messages,
      },
      {
        dir: SESSION_LOG_DIR,
      }
    );

    logger.info("CHAT", "Session messages saved", {
      sessionId,
      file: logFilePath,
      "messages.count": messages.length,
    });
  } catch (error) {
    logger.error("CHAT", "Failed to save session messages", error, {
      sessionId,
    });
  }
};
