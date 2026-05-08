import Router from "@koa/router";
import type Koa from "koa";
import { logger } from "../../utils/logger.ts";
import { ragController } from "./rag.controller.ts";
import { RagServiceError } from "./rag.service.ts";
import { RagValidationError } from "./rag.validation.ts";

type HttpLikeError = Error & {
  status?: number;
  code?: string;
};

const getErrorStatus = (error: HttpLikeError) => {
  if (error instanceof RagValidationError || error instanceof RagServiceError) {
    return error.status;
  }

  return error.status && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
};

const getErrorCode = (error: HttpLikeError, status: number) => {
  if (error instanceof RagValidationError || error instanceof RagServiceError) {
    return error.code;
  }

  return status === 500 ? "RAG_SERVER_ERROR" : "RAG_REQUEST_ERROR";
};

const handleRagErrors = async (ctx: Koa.Context, next: Koa.Next) => {
  try {
    await next();
  } catch (error) {
    const httpError = error as HttpLikeError;
    const status = getErrorStatus(httpError);

    if (status >= 500) {
      logger.error("RAG", "RAG route failed", httpError);
    }

    ctx.status = status;
    ctx.body = {
      error: {
        code: getErrorCode(httpError, status),
        message: status >= 500 ? "RAG request failed." : httpError.message,
      },
    };
  }
};

export const ragRouter = new Router();

ragRouter.use(handleRagErrors);

ragRouter.post(
  "/rag/files/:fileId/index",
  ragController.indexFile.bind(ragController)
);
ragRouter.get(
  "/rag/files/:fileId/status",
  ragController.getFileStatus.bind(ragController)
);
ragRouter.post("/rag/query", ragController.query.bind(ragController));

