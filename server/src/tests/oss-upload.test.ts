import { OssUploader, type UploadResult } from "../utils/ossUploader.ts";

type TestImage = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

/**
 * OSS 图片上传测试类。
 *
 * 使用一张 1x1 PNG 作为测试图片，避免依赖本地图片文件。
 * 执行后会真的向 OSS 上传一个对象，用来验证 OSS 配置和上传链路是否正常。
 */
export class OssUploadTest {
  private static readonly TEST_IMAGE_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

  static async run(): Promise<void> {
    const uploader = new OssUploader();
    const testImage = this.createTestImage();
    const uploadDir = process.env.OSS_TEST_UPLOAD_DIR || "tests/oss-upload";

    console.log("开始测试 OSS 图片上传...");
    console.log(`上传目录: ${uploadDir}`);
    console.log(`测试文件: ${testImage.filename}`);

    const result = await uploader.uploadBuffer(
      testImage.buffer,
      testImage.filename,
      testImage.mimeType,
      uploadDir
    );

    this.assertUploadResult(result);

    console.log("OSS 图片上传成功");
    console.log(`OSS Path: ${result.ossPath}`);
    console.log(`URL: ${result.url}`);
  }

  private static createTestImage(): TestImage {
    return {
      filename: `oss-upload-test-${Date.now()}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(this.TEST_IMAGE_BASE64, "base64"),
    };
  }

  private static assertUploadResult(result: UploadResult): void {
    if (!result.name) {
      throw new Error("OSS 上传失败：返回结果缺少 name");
    }

    if (!result.ossPath) {
      throw new Error("OSS 上传失败：返回结果缺少 ossPath");
    }

    if (!result.url) {
      throw new Error("OSS 上传失败：返回结果缺少 url");
    }
  }
}

OssUploadTest.run().catch((error) => {
  console.error("OSS 图片上传测试失败");
  console.error(error);
  process.exitCode = 1;
});
