import fs from "node:fs/promises";
import path from "node:path";

export class JsonFileUtil {
  /**
   * 安全地将对象转换为 JSON 字符串
   * 可以处理循环引用，避免 JSON.stringify 直接报错
   */
  static safeStringify(value: unknown, space = 2): string {
    const seen = new WeakSet<object>();

    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) {
            return "[Circular]";
          }

          seen.add(val);
        }

        return val;
      },
      space
    );
  }

  /**
   * 将对象写入 JSON 文件
   * 默认写入到当前项目运行目录下
   */
  static async writeJson(
    fileName: string,
    data: unknown,
    options?: {
      dir?: string;
      space?: number;
    }
  ): Promise<string> {
    const dir = options?.dir ?? process.cwd();
    const space = options?.space ?? 2;

    await fs.mkdir(dir, { recursive: true });

    const outputPath = path.resolve(dir, fileName);

    await fs.writeFile(
      outputPath,
      JsonFileUtil.safeStringify(data, space),
      "utf-8"
    );

    return outputPath;
  }

  /**
   * 读取 JSON 文件
   */
  static async readJson<T = unknown>(filePath: string): Promise<T> {
    const absolutePath = path.resolve(filePath);
    const content = await fs.readFile(absolutePath, "utf-8");

    return JSON.parse(content) as T;
  }
}