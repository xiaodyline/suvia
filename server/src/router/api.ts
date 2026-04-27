import Router from "@koa/router";
import { agent } from "../agents/agents.ts";
import { JsonFileUtil } from "../utils/json-file.util.ts";
import { MessageContentUtil } from "../utils/message-content.util.ts";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  messages?: ChatMessage[];
};

const apiRouter = new Router({
  prefix: "/api",
});

apiRouter.post("/chat", async (ctx) => {
  const body = ctx.request.body as ChatRequestBody;
  const messages = body.messages ?? [];

  if (messages.length === 0) {
    ctx.status = 400;
    ctx.body = { error: "messages 不能为空" };
    return;
  }

  const result = await agent.invoke({ messages });
  const lastMessage = result.messages.at(-1);

  await JsonFileUtil.writeJson("lastMessage.json", lastMessage, {
    dir: "logs",
  });

  const processedContent = await MessageContentUtil.processLastMessage(lastMessage);

  ctx.type = "text/plain; charset=utf-8";
  ctx.body = processedContent.responseText;
});

export default apiRouter;
