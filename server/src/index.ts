import Koa from "koa";
import cors from "@koa/cors";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { agent } from "./agents/agents.ts"

type ChatMessage = {
  role: "system" | "user" | "assistant",
  content: string
}

type ChatRequestBody = {
  messages?: ChatMessage[];
};

type ContentItem = {
  type: string;
  text: string;
  annotations: unknown[];
  phase: string;
};


const app = new Koa();
const router = new Router();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(bodyParser());

router.post("/api/chat", async (ctx) => {
  const body = ctx.request.body as ChatRequestBody;
  console.log(body);
  const messages = body.messages ?? [];

  if (messages.length === 0) {
    ctx.status = 400;
    ctx.body = { error: "messages 不能为空" };
    return;
  }

  const result = await agent.invoke({ messages });
  const lastMessage = result.messages.at(-1);
  // 安全获取最后一条消息的 content，只有当 content 是数组
  const content = Array.isArray(lastMessage?.content) ? lastMessage.content : [];
  const first_contentBlock = content.at(0) as ContentItem;

  ctx.type = "text/plain; charset=utf-8";
  ctx.body = first_contentBlock.text;

})

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3001, () => {
  console.log("Koa API running at http://localhost:3001");
});