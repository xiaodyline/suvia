import Router from "@koa/router";
import multer from "@koa/multer";
import type Koa from "koa";
import { filesController } from "./files.controller.ts";
import { getFilesConfig } from "./files.config.ts";
import { FileValidationError } from "./files.validation.ts";
import { logger } from "../../utils/logger.ts";

type HttpLikeError = Error & {
  status?: number;
  code?: string;
};

type MulterOptionsWithCharset = NonNullable<Parameters<typeof multer>[0]> & {
  defParamCharset?: string;
};

const uploadOptions: MulterOptionsWithCharset = {
  storage: multer.memoryStorage(),
  defParamCharset: "utf8",
  limits: {
    fileSize: getFilesConfig().maxSizeBytes,
    files: 1,
  },
};

const upload = multer(uploadOptions);

const getErrorStatus = (error: HttpLikeError) => {
  if (error instanceof FileValidationError) {
    return error.status;
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    return 413;
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return 400;
  }

  return error.status && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
};

const getErrorCode = (error: HttpLikeError, status: number) => {
  if (error instanceof FileValidationError || error.code) {
    return error.code;
  }

  return status === 500 ? "FILE_SERVER_ERROR" : "FILE_REQUEST_ERROR";
};

const getErrorMessage = (error: HttpLikeError, status: number) => {
  if (status === 413) {
    return "File size exceeds the configured limit.";
  }

  if (status === 500) {
    return "File request failed.";
  }

  return error.message;
};

const handleFileErrors = async (ctx: Koa.Context, next: Koa.Next) => {
  try {
    await next();
  } catch (error) {
    const httpError = error as HttpLikeError;
    const status = getErrorStatus(httpError);
    const requestLogMeta = {
      method: ctx.method,
      path: ctx.path,
      status,
      error: httpError.message,
    };

    if (status >= 500) {
      logger.error("SERVER", "Request failed", requestLogMeta);
    } else {
      logger.warn("SERVER", "Request failed", requestLogMeta);
    }

    if (ctx.path.endsWith("/files/upload")) {
      logger.warn("FILES", "Upload failed", {
        error: httpError.message,
      });
    }

    ctx.status = status;
    ctx.body = {
      error: {
        code: getErrorCode(httpError, status),
        message: getErrorMessage(httpError, status),
      },
    };
  }
};

export const filesRouter = new Router();

filesRouter.use(handleFileErrors);

filesRouter.get("/files", filesController.listFiles.bind(filesController));
filesRouter.post(
  "/files/upload",
  upload.single("file"),
  filesController.uploadFile.bind(filesController)
);
filesRouter.get(
  "/files/:fileId/download",
  filesController.downloadFile.bind(filesController)
);
filesRouter.get(
  "/files/:fileId/url",
  filesController.getFileUrl.bind(filesController)
);
