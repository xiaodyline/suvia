import type { ServerResponse } from "node:http";
import type { SseEventName } from "../services/chat/chat.types.ts";

export const canWrite = (res: ServerResponse) => {
  return !res.destroyed && !res.writableEnded;
};

export const setupSseHeaders = (res: ServerResponse) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
};

export const writeSseEvent = (
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

export const endSse = (res: ServerResponse) => {
  if (canWrite(res)) {
    res.end();
  }
};

export const createSseWriter = (res: ServerResponse) => {
  return {
    write: (event: SseEventName, data: unknown) =>
      writeSseEvent(res, event, data),
    text: (delta: string) => writeSseEvent(res, "text", { delta }),
    status: (message: string) => writeSseEvent(res, "status", { message }),
    done: () => writeSseEvent(res, "done", {}),
    error: (message: string) => writeSseEvent(res, "error", { message }),
    end: () => endSse(res),
    canWrite: () => canWrite(res),
  };
};

export type SseWriter = ReturnType<typeof createSseWriter>;
