import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

type UnknownRecord = Record<string, unknown>;

/**
 * 处理消息内容时的可选配置。
 *
 * imageDir 用来指定图片保存目录；不传时默认保存到 logs/images。
 * imageUrlPrefix 用来指定返回给前端的图片访问地址前缀；不传时只返回本地保存结果。
 */
type ProcessMessageOptions = {
  imageDir?: string;
  imageUrlPrefix?: string;
};

/**
 * 单个 content item 处理后的标准结果。
 *
 * responseText 是最终拼接给前端展示的文本，例如普通文本或 Markdown 图片链接。
 * 图片类型会额外返回 fileName、filePath、mimeType 和可访问 url。
 */
export type ProcessedContentItem = {
  type: "text" | "image" | "unsupported";
  responseText: string;
  text?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  url?: string;
  originalType?: string;
};

/**
 * 一整条 AI 消息处理后的结果。
 *
 * items 保留每个 content item 的处理详情；
 * responseText 是把所有 item 的 responseText 合并后的最终回复内容。
 */
export type ProcessedMessageContent = {
  items: ProcessedContentItem[];
  responseText: string;
};

/**
 * AI 消息 content 处理工具。
 *
 * 负责兼容 LangChain 消息中的 content / kwargs.content，
 * 并按不同 content.type 分发到对应处理逻辑。
 */
export class MessageContentUtil {
  /** 图片默认保存目录。 */
  static readonly DEFAULT_IMAGE_DIR = path.resolve("logs", "images");

  /**
   * 从最后一条消息中提取 content 数组。
   *
   * 兼容两种结构：
   * 1. lastMessage.content
   * 2. lastMessage.kwargs.content
   */
  static getContentItems(lastMessage: unknown): unknown[] {
    if (!this.isRecord(lastMessage)) {
      return [];
    }

    if (Array.isArray(lastMessage.content)) {
      return lastMessage.content;
    }

    const kwargs = lastMessage.kwargs;
    if (this.isRecord(kwargs) && Array.isArray(kwargs.content)) {
      return kwargs.content;
    }

    return [];
  }

  /**
   * 处理最后一条消息中的所有 content item。
   *
   * 文本会原样返回；图片会解码 base64 并保存到本地，
   * 最后把所有处理结果合并成一个 responseText。
   */
  static async processLastMessage(
    lastMessage: unknown,
    options: ProcessMessageOptions = {}
  ): Promise<ProcessedMessageContent> {
    const contentItems = this.getContentItems(lastMessage);
    const items: ProcessedContentItem[] = [];

    for (const item of contentItems) {
      items.push(await this.processContentItem(item, options));
    }

    return {
      items,
      responseText: items
        .map((item) => item.responseText)
        .filter(Boolean)
        .join("\n\n"),
    };
  }

  /**
   * 根据文件名读取已经保存过的生成图片。
   *
   * 只允许读取图片目录下的单个文件名，避免通过 ../ 访问其它路径。
   * 找不到图片时返回 null。
   */
  static async readGeneratedImage(
    fileName: string,
    options: Pick<ProcessMessageOptions, "imageDir"> = {}
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const safeFileName = path.basename(fileName);
    if (safeFileName !== fileName) {
      return null;
    }

    const imageDir = path.resolve(options.imageDir ?? this.DEFAULT_IMAGE_DIR);
    const filePath = path.resolve(imageDir, safeFileName);
    const relativePath = path.relative(imageDir, filePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return null;
    }

    try {
      return {
        buffer: await fs.readFile(filePath),
        mimeType: this.mimeTypeFromFileName(safeFileName),
      };
    } catch (error) {
      if (this.isNodeError(error) && error.code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  /**
   * 按 content.type 分发处理逻辑。
   *
   * text / output_text 走文本处理；
   * image 走图片保存处理；
   * 其它类型统一返回 unsupported。
   */
  private static async processContentItem(
    item: unknown,
    options: ProcessMessageOptions
  ): Promise<ProcessedContentItem> {
    if (!this.isRecord(item)) {
      return this.processUnsupportedContent("unknown");
    }

    const type = typeof item.type === "string" ? item.type : "unknown";

    switch (type) {
      case "text":
      case "output_text":
        return this.processTextContent(item);
      case "image":
        return this.processImageContent(item, options);
      default:
        return this.processUnsupportedContent(type);
    }
  }

  /** 处理文本内容，返回可直接展示的文本。 */
  private static processTextContent(item: UnknownRecord): ProcessedContentItem {
    const text = typeof item.text === "string" ? item.text : "";

    return {
      type: "text",
      text,
      responseText: text,
    };
  }

  /**
   * 处理图片内容。
   *
   * 图片 data 是 base64 字符串，支持普通 base64 和 data URL；
   * 处理后会写入本地文件，并在配置了 imageUrlPrefix 时返回 Markdown 图片链接。
   */
  private static async processImageContent(
    item: UnknownRecord,
    options: ProcessMessageOptions
  ): Promise<ProcessedContentItem> {
    const data = typeof item.data === "string" ? item.data : "";

    if (!data) {
      return this.processUnsupportedContent("image", "Image content is missing data.");
    }

    const mimeTypeValue = item.mimeType ?? item.mime_type;
    const mimeType =
      typeof mimeTypeValue === "string" && mimeTypeValue.startsWith("image/")
        ? mimeTypeValue
        : "image/png";

    const imageDir = path.resolve(options.imageDir ?? this.DEFAULT_IMAGE_DIR);
    const extension = this.extensionFromMimeType(mimeType);
    const fileName = `image-${Date.now()}-${randomUUID()}.${extension}`;
    const filePath = path.resolve(imageDir, fileName);
    const imageBuffer = Buffer.from(this.normalizeBase64Data(data), "base64");

    await fs.mkdir(imageDir, { recursive: true });
    await fs.writeFile(filePath, imageBuffer);

    const url = this.buildImageUrl(options.imageUrlPrefix, fileName);
    const responseText = url
      ? `![generated image](${url})`
      : `图片已保存到：\`${filePath}\``;

    return {
      type: "image",
      fileName,
      filePath,
      mimeType,
      url,
      responseText,
    };
  }

  /** 处理未知或暂不支持的 content 类型。 */
  private static processUnsupportedContent(
    originalType: string,
    message = ""
  ): ProcessedContentItem {
    return {
      type: "unsupported",
      originalType,
      responseText: message || `暂不支持的内容类型：${originalType}`,
    };
  }

  /**
   * 规范化 base64 图片数据。
   *
   * 如果传入的是 data:image/png;base64,... 形式，会去掉 data URL 头；
   * 同时移除空白字符，避免 Buffer 解码失败。
   */
  private static normalizeBase64Data(data: string): string {
    return data.replace(/^data:[^;]+;base64,/i, "").replace(/\s/g, "");
  }

  /** 使用 URL 前缀和文件名拼出前端可访问的图片地址。 */
  private static buildImageUrl(
    imageUrlPrefix: string | undefined,
    fileName: string
  ): string | undefined {
    if (!imageUrlPrefix) {
      return undefined;
    }

    return `${imageUrlPrefix.replace(/\/$/, "")}/${encodeURIComponent(fileName)}`;
  }

  /** 根据图片 MIME 类型推导保存文件的扩展名。 */
  private static extensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      "image/gif": "gif",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/svg+xml": "svg",
      "image/webp": "webp",
    };

    const normalizedMimeType = mimeType.toLowerCase();
    const fallbackExtension = normalizedMimeType
      .split("/")[1]
      ?.split("+")[0]
      ?.replace(/[^a-z0-9]/g, "");

    return extensions[normalizedMimeType] ?? fallbackExtension ?? "png";
  }

  /** 根据文件扩展名推导响应图片时使用的 MIME 类型。 */
  private static mimeTypeFromFileName(fileName: string): string {
    const mimeTypes: Record<string, string> = {
      ".gif": "image/gif",
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
    };

    return mimeTypes[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";
  }

  /** 判断 unknown 值是否是可读取属性的对象。 */
  private static isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null;
  }

  /** 判断异常是否是 Node.js 文件系统错误。 */
  private static isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
  }
}
