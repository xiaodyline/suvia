import type Koa from "koa";
import { ragService } from "./rag.service.ts";
import { validateFileIdParam, validateRagQueryBody } from "./rag.validation.ts";

export class RagController {
  async indexFile(ctx: Koa.Context) {
    const fileId = validateFileIdParam(ctx.params.fileId);
    const result = await ragService.startIndex(fileId);

    ctx.status = 202;
    ctx.body = result;
  }

  async getFileStatus(ctx: Koa.Context) {
    const fileId = validateFileIdParam(ctx.params.fileId);
    ctx.body = await ragService.getFileStatus(fileId);
  }

  async query(ctx: Koa.Context) {
    const input = validateRagQueryBody(ctx.request.body);
    ctx.body = await ragService.query(input);
  }
}

export const ragController = new RagController();

