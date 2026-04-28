import Router from "@koa/router";
import { chatController } from "../controllers/chat.controller.ts";

const apiRouter = new Router({
  prefix: "/api",
});

apiRouter.post("/chat", chatController.handleChat);

export default apiRouter;
