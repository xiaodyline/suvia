import type Koa from "koa";
import { logger } from "../../utils/logger.ts";
import { ragService } from "./rag.service.ts";
import { validateFileIdParam, validateRagQueryBody } from "./rag.validation.ts";

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

export class RagController {
  async indexFile(ctx: Koa.Context) {
    const fileId = validateFileIdParam(ctx.params.fileId);
    const result = await ragService.startIndex(fileId);

    ctx.status = 202;
    ctx.body = result;
  }

  async getFileStatus(ctx: Koa.Context) {
    const fileId = validateFileIdParam(ctx.params.fileId);
    logger.info("RAG", "RAG status request received", { fileId });

    ctx.body = await ragService.getFileStatus(fileId);
  }

  async query(ctx: Koa.Context) {
    let input;

    try {
      input = validateRagQueryBody(ctx.request.body);
    } catch (error) {
      logger.warn("RAG", "RAG query validation failed", {
        error: getErrorMessage(error),
      });
      throw error;
    }

    ctx.body = await ragService.query(input);
  }
}

export const ragController = new RagController();
