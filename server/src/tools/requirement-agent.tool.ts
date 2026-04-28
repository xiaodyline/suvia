import { tool } from "langchain";
import type { RunnableConfig } from "@langchain/core/runnables";
import * as z from "zod";
import { getRequirementWriterAgent } from "../agents/requirement.agent.ts";
import { logger } from "../utils/logger.ts";

type UnknownRecord = Record<string, unknown>;

const requirementWriterAgentToolSchema = z.object({
  task: z
    .string()
    .describe(
      "需要交给需求文档编写专家完成的具体任务，例如编写 SRS、项目概述、功能需求、非功能需求、系统边界或生成需求文档配图。"
    ),
  context: z
    .string()
    .optional()
    .describe("用户已提供的项目背景、历史上下文、业务规则、章节结构或补充材料。"),
  styleRequirements: z
    .string()
    .optional()
    .describe("输出风格、格式、篇幅、章节编号、表格使用或语言要求。"),
});

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null;
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

const extractTextFromMessage = (message: unknown): string => {
  if (!isRecord(message)) {
    return "";
  }

  const directContent = extractTextFromContent(message.content);

  if (directContent) {
    return directContent;
  }

  const kwargs = isRecord(message.kwargs) ? message.kwargs : undefined;
  return extractTextFromContent(kwargs?.content);
};

const extractFinalText = (result: unknown): string => {
  if (isRecord(result) && Array.isArray(result.messages)) {
    for (let index = result.messages.length - 1; index >= 0; index -= 1) {
      const text = extractTextFromMessage(result.messages[index]).trim();

      if (text) {
        return text;
      }
    }
  }

  return extractTextFromMessage(result).trim();
};

const hasExplicitImageRequirement = (
  input: z.infer<typeof requirementWriterAgentToolSchema>
) => {
  const text = [input.task, input.context, input.styleRequirements]
    .filter(Boolean)
    .join("\n");

  return /生成.*图|画.*图|配图|插图|功能结构图|功能模块图|业务流程图|系统架构图|数据流图|页面草图|原型图|结构图|流程图|架构图/.test(
    text
  );
};

const buildRequirementWriterPrompt = (
  input: z.infer<typeof requirementWriterAgentToolSchema>
) => {
  return [
    "请作为需求文档编写专家完成以下任务。",
    `任务：${input.task}`,
    input.context ? `上下文：\n${input.context}` : "",
    input.styleRequirements ? `格式与风格要求：\n${input.styleRequirements}` : "",
    hasExplicitImageRequirement(input)
      ? [
          "图片生成硬性要求：",
          "1. 当前任务包含明确的图片/图表生成要求，必须调用 generate_srs_image 工具生成真实图片。",
          "2. 不得用 Mermaid、flowchart、PlantUML、ASCII 图、Markdown 代码块或文字图代替图片。",
          "3. 最终文档中必须使用 generate_srs_image 返回的 Markdown 图片链接。",
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const requirementWriterAgentTool = tool(
  async (input, config?: RunnableConfig) => {
    logger.info("TOOL", "requirement_writer_agent invoked", {
      "task.length": input.task.length,
      "context.provided": Boolean(input.context),
      "styleRequirements.provided": Boolean(input.styleRequirements),
    });

    try {
      const requirementWriterAgent = getRequirementWriterAgent();
      const result = await requirementWriterAgent.invoke(
        {
          messages: [
            {
              role: "user",
              content: buildRequirementWriterPrompt(input),
            },
          ],
        },
        {
          ...config,
          tags: Array.from(
            new Set([...(config?.tags ?? []), "subagent", "requirement_writer_agent"])
          ),
          metadata: {
            ...(isRecord(config?.metadata) ? config.metadata : {}),
            source: "requirement_writer_agent",
          },
        }
      );
      const finalText = extractFinalText(result);

      if (!finalText) {
        throw new Error("RequirementWriterAgent returned no text content.");
      }

      return finalText;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown RequirementWriterAgent error.";

      throw new Error(`RequirementWriterAgent failed: ${message}`);
    }
  },
  {
    name: "requirement_writer_agent",
    description:
      "用于编写需求分析说明书、SRS、项目概述、功能需求、非功能需求、系统边界、用户角色、业务流程、软件需求文档，以及处理需求文档配图、功能结构图等相关任务。",
    schema: requirementWriterAgentToolSchema
  }
);
