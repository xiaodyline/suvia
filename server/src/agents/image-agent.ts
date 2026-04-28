import { tools } from "@langchain/openai";
import { createAgent, tool } from "langchain";
import type { RunnableConfig } from "@langchain/core/runnables";
import * as z from "zod";
import { model } from "../models/model.ts";
import { imageAgentPrompt } from "../prompts/imageAgentPrompt.ts";
import { MessageContentUtil } from "../utils/message-content.util.ts";

type UnknownRecord = Record<string, unknown>;

const imageTaskSchema = z.object({
  title: z.string().describe("插图标题，用于最终 SRS 文档中的图题或 alt 文本。"),
  placement: z.string().describe("建议插入到需求分析说明书中的章节位置。"),
  diagramType: z
    .enum(["业务流程图", "系统架构图", "功能模块图", "数据流图", "页面草图", "其他"])
    .describe("插图类型。"),
  description: z
    .string()
    .describe("给 ImageAgent 的完整图片任务描述，需要包含节点、关系、布局、风格和中文文字要求。"),
});

export const ImageAgent = createAgent({
  model,
  tools: [
    tools.imageGeneration({
      outputFormat: "png",
      quality: "medium",
      size: "1536x1024",
    }),
  ],
  systemPrompt: imageAgentPrompt,
});

const buildImageAgentUserPrompt = (task: z.infer<typeof imageTaskSchema>) => {
  return [
    `插图标题：${task.title}`,
    `建议插入位置：${task.placement}`,
    `插图类型：${task.diagramType}`,
    "",
    "请根据下面的任务描述生成一张适合《需求分析说明书》的图片：",
    task.description,
  ].join("\n");
};

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null;
};

export const generateSrsImageTool = tool(
  async (task, config?: RunnableConfig) => {
    const result = await ImageAgent.invoke(
      {
        messages: [
          {
            role: "user",
            content: buildImageAgentUserPrompt(task),
          },
        ],
      },
      {
        ...config,
        tags: Array.from(new Set([...(config?.tags ?? []), "subagent", "image_agent"])),
        metadata: {
          ...(isRecord(config?.metadata) ? config.metadata : {}),
          source: "image_agent",
        },
      }
    );

    const lastMessage = result.messages.at(-1);
    const processedContent = await MessageContentUtil.processLastMessage(lastMessage, {
      ossDir: "srs-images",
    });
    const imageItems = processedContent.items.filter((item) => item.type === "image" && item.url);

    if (imageItems.length === 0) {
      return [
        `插图《${task.title}》生成失败：ImageAgent 未返回可上传的图片。`,
        processedContent.responseText ? `ImageAgent 返回内容：${processedContent.responseText}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    return imageItems
      .map((item, index) => {
        const suffix = imageItems.length > 1 ? ` ${index + 1}` : "";
        return [
          `插图标题：${task.title}${suffix}`,
          `建议插入位置：${task.placement}`,
          `图片地址：${item.url}`,
          `Markdown：![${task.title}${suffix}](${item.url})`,
        ].join("\n");
      })
      .join("\n\n");
  },
  {
    name: "generate_srs_image",
    description:
      "把需求分析说明书中的插图任务交给次级代理 ImageAgent，生成图片并返回可插入最终文档的 OSS 图片地址和 Markdown。",
    schema: imageTaskSchema,
  }
);
