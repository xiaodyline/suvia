import Router from '@koa/router';
import { agent } from '../agents/agents.ts';
import { JsonFileUtil } from '../utils/json-file.util.ts';

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



const apiRouter = new Router({
  prefix: '/api',
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
  const filePath = await JsonFileUtil.writeJson("lastMessage.json", lastMessage, {
    dir: "logs",
  });
  // 安全获取最后一条消息的 content，只有当 content 是数组
  const content = Array.isArray(lastMessage?.content) ? lastMessage.content : [];
  const first_contentBlock = content.at(0) as ContentItem;

  ctx.type = "text/plain; charset=utf-8";
  ctx.body = first_contentBlock.text;

})

export default apiRouter