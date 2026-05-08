import type Koa from "koa";
import { logger } from "../../utils/logger.ts";
import { filesService, toApiFileRecord } from "./files.service.ts";

type MultipartBody = {
  purpose?: unknown;
};

const encodeContentDisposition = (filename: string) => {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

export class FilesController {
  async uploadFile(ctx: Koa.Context) {
    const body = ctx.request.body as MultipartBody | undefined;
    logger.info("FILES", "Upload request received", {
      originalName: ctx.file?.originalname,
      mimeType: ctx.file?.mimetype,
      sizeBytes: ctx.file?.size,
      purpose: body?.purpose,
    });

    const record = await filesService.uploadFile(ctx.file, body?.purpose);

    ctx.status = 201;
    ctx.body = {
      file: toApiFileRecord(record),
    };
  }

  async listFiles(ctx: Koa.Context) {
    const files = await filesService.listFiles();

    ctx.body = {
      files: files.map(toApiFileRecord),
    };
  }

  async downloadFile(ctx: Koa.Context) {
    logger.info("FILES", "Download request received", {
      fileId: ctx.params.fileId,
    });

    const { record, stream } = await filesService.getDownloadStream(
      ctx.params.fileId
    );

    ctx.set("Content-Type", record.mimeType);
    ctx.set("Content-Length", String(record.sizeBytes));
    ctx.set("Content-Disposition", encodeContentDisposition(record.originalName));
    ctx.body = stream;
  }

  async getFileUrl(ctx: Koa.Context) {
    logger.info("FILES", "File URL request received", {
      fileId: ctx.params.fileId,
    });

    const { record, url } = await filesService.getFileAccessUrl(ctx.params.fileId);

    ctx.body = {
      file: toApiFileRecord(record),
      url,
    };
  }
}

export const filesController = new FilesController();
