> ## 文档索引
> 完整文档索引可在此获取：https://docs.langchain.com/llms.txt
> 在继续深入阅读前，可以用这个文件发现所有可用页面。

# 总览

> 使用 LangChain Agent 的实时流式能力构建生成式 UI

为通过 `createAgent` 创建的 Agent 构建丰富、交互式的前端界面。这些模式覆盖了从基础消息渲染，到人工审批、时间旅行调试等高级工作流的完整场景。

## 架构

每一种模式都遵循相同的架构：`createAgent` 后端通过 `useStream` Hook 将状态流式传输给前端。

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{
  init: {
    "fontFamily": "monospace",
    "flowchart": {
      "curve": "curve"
    }
  }
}%%
graph LR
  FRONTEND["useStream()"]
  BACKEND["createAgent()"]

  BACKEND --"stream"--> FRONTEND
  FRONTEND --"submit"--> BACKEND

  classDef blueHighlight fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A;
  classDef greenHighlight fill:#DCFCE7,stroke:#16A34A,color:#14532D;
  class FRONTEND blueHighlight;
  class BACKEND greenHighlight;
```

在后端，`createAgent` 会生成一个已编译的 LangGraph 图，并暴露流式 API。在前端，`useStream` Hook 会连接到这个 API，并提供响应式状态，包括 messages、tool calls、interrupts、history 等。你可以用任意前端框架渲染这些状态。

<CodeGroup>
  ```ts agent.ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { createAgent } from "langchain";
  import { MemorySaver } from "@langchain/langgraph";

  const agent = createAgent({
    model: "openai:gpt-5.4",
    tools: [getWeather, searchWeb],
    checkpointer: new MemorySaver(),
  });
  ```

  ```tsx Chat.tsx theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { useStream } from "@langchain/react";
  import type { agent } from "./agent";

  function Chat() {
    const stream = useStream<typeof agent>({
      apiUrl: "http://localhost:2024",
      assistantId: "agent",
    });

    return (
      <div>
        {stream.messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}
      </div>
    );
  }
  ```
</CodeGroup>

`useStream` 可用于 React、Vue、Svelte 和 Angular：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { useStream } from "@langchain/react";   // React
import { useStream } from "@langchain/vue";      // Vue
import { useStream } from "@langchain/svelte";   // Svelte
import { useStream } from "@langchain/angular";  // Angular
```

## 模式

### 渲染消息和输出

<CardGroup cols={3}>
  <Card title="Markdown 消息" icon="markdown" href="/oss/javascript/langchain/frontend/markdown-messages">
    解析并渲染流式 Markdown，包含正确的格式化和代码高亮。
  </Card>

  <Card title="结构化输出" icon="layout-grid" href="/oss/javascript/langchain/frontend/structured-output">
    将带类型的 Agent 响应渲染为自定义 UI 组件，而不是普通文本。
  </Card>

  <Card title="推理 token" icon="brain" href="/oss/javascript/langchain/frontend/reasoning-tokens">
    在可折叠区块中展示模型的思考过程。
  </Card>

  <Card title="生成式 UI" icon="wand" href="/oss/javascript/langchain/frontend/generative-ui">
    使用 json-render，根据自然语言提示渲染 AI 生成的用户界面。
  </Card>
</CardGroup>

### 展示 Agent 动作

<CardGroup cols={3}>
  <Card title="工具调用" icon="tool" href="/oss/javascript/langchain/frontend/tool-calling">
    以丰富且类型安全的 UI 卡片展示工具调用，并包含加载和错误状态。
  </Card>

  <Card title="人在回路中" icon="user-check" href="/oss/javascript/langchain/frontend/human-in-the-loop">
    让 Agent 暂停并等待人工审核，支持批准、拒绝和编辑工作流。
  </Card>
</CardGroup>

### 管理对话

<CardGroup cols={3}>
  <Card title="分支对话" icon="git-branch" href="/oss/javascript/langchain/frontend/branching-chat">
    编辑消息、重新生成响应，并在不同对话分支之间导航。
  </Card>

  <Card title="消息队列" icon="list-check" href="/oss/javascript/langchain/frontend/message-queues">
    在 Agent 顺序处理消息时，将多条消息排入队列。
  </Card>
</CardGroup>

### 高级流式能力

<CardGroup cols={3}>
  <Card title="加入和重新加入流" icon="plug-connected" href="/oss/javascript/langchain/frontend/join-rejoin">
    从正在运行的 Agent 流中断开并重新连接，同时不丢失进度。
  </Card>

  <Card title="时间旅行" icon="clock" href="/oss/javascript/langchain/frontend/time-travel">
    查看、导航并从对话历史中的任意检查点恢复执行。
  </Card>
</CardGroup>

## 集成

`useStream` 与 UI 框架无关。你可以把它用于任何组件库或生成式 UI 框架。

<CardGroup cols={3}>
  <Card title="AI Elements" icon="package" href="/oss/javascript/langchain/frontend/integrations/ai-elements">
    面向 AI 对话的可组合 shadcn/ui 组件：`Conversation`、`Message`、`Tool`、`Reasoning`。
  </Card>

  <Card title="assistant-ui" icon="package" href="/oss/javascript/langchain/frontend/integrations/assistant-ui">
    无头 React 框架，内置线程管理、分支和附件支持。
  </Card>

  <Card title="OpenUI" icon="package" href="/oss/javascript/langchain/frontend/integrations/openui">
    用于数据密集型报告和仪表盘的生成式 UI 库，基于 openui-lang 组件 DSL。
  </Card>
</CardGroup>

***

<div className="source-links">
  <Callout icon="terminal-2">
    [连接这些文档](/use-these-docs)到 Claude、VSCode 等工具，并通过 MCP 获得实时回答。
  </Callout>

  <Callout icon="edit">
    [在 GitHub 上编辑此页面](https://github.com/langchain-ai/docs/edit/main/src/oss/langchain/frontend/overview.mdx) 或 [提交 issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>
