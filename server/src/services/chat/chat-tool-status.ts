import { isRecord } from "../../utils/type-guards.ts";
import { logger } from "../../utils/logger.ts";

export const getToolStatusMessage = (payload: unknown): string | undefined => {
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

export const logToolEvent = (payload: unknown) => {
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
