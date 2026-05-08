import Router from "@koa/router";
import { chatController } from "../controllers/chat.controller.ts";
import { filesRouter } from "../modules/files/files.router.ts";
import { ragRouter } from "../modules/rag/rag.router.ts";

const apiRouter = new Router({
  prefix: "/api",
});

apiRouter.post("/chat", chatController.handleChat);
apiRouter.use(filesRouter.routes(), filesRouter.allowedMethods());
apiRouter.use(ragRouter.routes(), ragRouter.allowedMethods());

export default apiRouter;
