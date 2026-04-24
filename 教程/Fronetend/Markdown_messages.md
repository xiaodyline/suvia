> ## 文档索引
> 完整文档索引可在此获取：https://docs.langchain.com/llms.txt
> 在继续深入阅读前，可以用这个文件发现所有可用页面。

# Markdown 消息

## Markdown 渲染的工作方式

渲染流水线分为三个步骤：

1. **接收：** `useStream` 会把流式返回的文本累积到每条 AI 消息的 `msg.text` 中，并随着新 token 到达而响应式更新。
2. **解析：** Markdown 解析器会把原始文本转换为 HTML，或转换为 React 元素树。这个过程会在每次更新时运行，但对于聊天长度的内容足够快，例如 5 KB 消息通常低于 5ms。
3. **渲染：** 解析后的输出会被渲染到 DOM 中。React 使用虚拟 DOM diff；Vue 和 Svelte 使用经过清洗的 HTML，并通过 `v-html` / `{@html}` 渲染。

## 设置 useStream

Markdown 模式使用一个简单的聊天 Agent，不需要特殊配置。将 `useStream` 与你的 Agent URL 和 assistant ID 连接起来即可。

导入你的 Agent，并将 `typeof myAgent` 作为类型参数传给 `useStream`，这样就能以类型安全的方式访问状态值：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import type { myAgent } from "./agent";
```

<CodeGroup>
  ```tsx React theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { useStream } from "@langchain/react";
  import { AIMessage, HumanMessage } from "@langchain/core/messages";

  const AGENT_URL = "http://localhost:2024";

  export function Chat() {
    const stream = useStream<typeof myAgent>({
      apiUrl: AGENT_URL,
      assistantId: "simple_agent",
    });

    return (
      <div>
        {stream.messages.map((msg) => {
          if (AIMessage.isInstance(msg)) {
            return <Markdown key={msg.id}>{msg.text}</Markdown>;
          }
          if (HumanMessage.isInstance(msg)) {
            return <p key={msg.id}>{msg.text}</p>;
          }
        })}
      </div>
    );
  }
  ```

  ```vue Vue theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  <script setup lang="ts">
  import { useStream } from "@langchain/vue";
  import { AIMessage, HumanMessage } from "@langchain/core/messages";

  const AGENT_URL = "http://localhost:2024";

  const stream = useStream<typeof myAgent>({
    apiUrl: AGENT_URL,
    assistantId: "simple_agent",
  });
  </script>

  <template>
    <div>
      <template v-for="msg in stream.messages.value" :key="msg.id">
        <Markdown v-if="AIMessage.isInstance(msg)">{{ msg.text }}</Markdown>
        <p v-else-if="HumanMessage.isInstance(msg)">{{ msg.text }}</p>
      </template>
    </div>
  </template>
  ```

  ```svelte Svelte theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  <script lang="ts">
    import { useStream } from "@langchain/svelte";
    import { AIMessage, HumanMessage } from "@langchain/core/messages";

    const AGENT_URL = "http://localhost:2024";

    const { messages, submit } = useStream<typeof myAgent>({
      apiUrl: AGENT_URL,
      assistantId: "simple_agent",
    });
  </script>

  <div>
    {#each $messages as msg (msg.id)}
      {#if AIMessage.isInstance(msg)}
        <Markdown content={msg.text} />
      {:else if HumanMessage.isInstance(msg)}
        <p>{msg.text}</p>
      {/if}
    {/each}
  </div>
  ```

  ```ts Angular theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { Component } from "@angular/core";
  import { useStream } from "@langchain/angular";

  const AGENT_URL = "http://localhost:2024";

  @Component({
    selector: "app-chat",
    template: `
      @for (msg of stream.messages(); track msg.id) {
        <app-markdown [content]="msg.text" />
      }
    `,
  })
  export class ChatComponent {
    stream = useStream<typeof myAgent>({
      apiUrl: AGENT_URL,
      assistantId: "simple_agent",
    });
  }
  ```
</CodeGroup>

## 选择 Markdown 库

每个框架都有更自然的 Markdown 渲染选择：

| 框架 | 库 | 输出 | 原因 |
| ---- | ---- | ---- | ---- |
| React | `react-markdown` + `remark-gfm` | React 元素 | 基于组件、支持虚拟 DOM diff，不需要 `dangerouslySetInnerHTML` |
| Vue | `marked` + `dompurify` | 通过 `v-html` 输出清洗后的 HTML | 轻量、快速、内置 GFM |
| Svelte | `marked` + `dompurify` | 通过 `{@html}` 输出清洗后的 HTML | 与 Vue 相同，API 一致 |
| Angular | `marked` + `dompurify` | 通过 `[innerHTML]` 输出清洗后的 HTML | 与 Vue/Svelte 相同 |

<Tip>
  React 的 `react-markdown` 会把 Markdown 直接转换为 React 元素，因此不需要 HTML 清洗，也不会涉及 `dangerouslySetInnerHTML`。
  对于 Vue、Svelte 和 Angular，始终要先用 `dompurify` 清洗解析后的 HTML，再进行渲染。
</Tip>

## 构建 Markdown 组件

<CodeGroup>
  ```tsx React theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import ReactMarkdown from "react-markdown";
  import remarkGfm from "remark-gfm";

  export function Markdown({ children }: { children: string }) {
    return (
      <div className="markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {children}
        </ReactMarkdown>
      </div>
    );
  }
  ```

  ```vue Vue theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  <script setup lang="ts">
  import { computed, useSlots } from "vue";
  import { marked } from "marked";
  import DOMPurify from "dompurify";

  marked.setOptions({ gfm: true, breaks: true });

  const slots = useSlots();

  const html = computed(() => {
    const slot = slots.default?.();
    const text = slot
      ?.map((vnode) =>
        typeof vnode.children === "string" ? vnode.children : ""
      )
      .join("") ?? "";
    if (!text) return "";
    return DOMPurify.sanitize(marked.parse(text) as string);
  });
  </script>

  <template>
    <div class="markdown-content" v-html="html" />
  </template>
  ```

  ```svelte Svelte theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  <script lang="ts">
    import { marked } from "marked";
    import DOMPurify from "dompurify";

    let { content }: { content: string } = $props();

    marked.setOptions({ gfm: true, breaks: true });

    let html = $derived.by(() => {
      if (!content) return "";
      return DOMPurify.sanitize(marked.parse(content) as string);
    });
  </script>

  <div class="markdown-content">
    {@html html}
  </div>
  ```

  ```ts Angular theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { Component, Input, computed, signal } from "@angular/core";
  import { marked } from "marked";
  import DOMPurify from "dompurify";

  marked.setOptions({ gfm: true, breaks: true });

  @Component({
    selector: "app-markdown",
    template: `<div class="markdown-content" [innerHTML]="html()"></div>`,
  })
  export class MarkdownComponent {
    @Input() set content(value: string) {
      this._content.set(value);
    }

    private _content = signal("");

    html = computed(() => {
      const text = this._content();
      if (!text) return "";
      return DOMPurify.sanitize(marked.parse(text) as string);
    });
  }
  ```
</CodeGroup>

## 清洗 HTML 输出

当你把解析后的 Markdown 作为原始 HTML 渲染时，例如使用 `v-html`、`{@html}` 或 `[innerHTML]`，必须先清洗输出，以防跨站脚本攻击（XSS）。LLM 响应可能包含任意文本，其中也可能包含会被 Markdown 解析器转换成可执行 HTML 的标记。

使用 `dompurify` 移除危险元素：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import DOMPurify from "dompurify";

const safeHtml = DOMPurify.sanitize(rawHtml);
```

DOMPurify 会移除 `<script>` 标签、`onclick` 属性、`javascript:` URL 以及其他 XSS 向量，同时保留标题、列表、代码块、表格和链接等安全的 Markdown 输出。

<Note>
  React 的 `react-markdown` 不需要 `dompurify`，因为它直接生成 React 元素，不涉及原始 HTML 注入。
</Note>

## 流式渲染注意事项

`useStream` 会在每个 token 到达时响应式更新 `msg.text`。Markdown 组件会在每次更新时重新解析。对于典型聊天消息，这种方式性能足够好：

* `marked` 解析速度约为 1 MB/s。5 KB 消息通常低于 5ms。
* `react-markdown` + remark 管线对聊天长度内容同样足够快。
* 浏览器布局引擎可以高效处理 DOM 更新。

对于很长的响应（> 50 KB），可以考虑以下优化：

* **节流渲染：** 使用 `requestAnimationFrame` 以 60fps 批量更新，而不是每个 token 都重新渲染一次。
* **增量解析：** 只解析新增内容，并追加到已渲染的缓冲区中。这是高级做法，聊天 UI 通常不需要。

<Info>
  对大多数聊天应用来说，每次 token 更新时重新解析整条消息的简单方案已经足够。只有当超长消息导致滚动卡顿或掉帧时，才需要优化。
</Info>

## 设置 Markdown 内容样式

给 `.markdown-content` 类添加样式，用来控制渲染后 Markdown 的外观。下面是必要样式：

```css theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
.markdown-content p {
  margin: 0.4em 0;
}

.markdown-content ul,
.markdown-content ol {
  margin: 0.4em 0;
  padding-left: 1.4em;
}

.markdown-content pre {
  overflow-x: auto;
  border-radius: 0.375rem;
  background: rgba(0, 0, 0, 0.05);
  padding: 0.5rem;
  font-size: 0.75rem;
}

.markdown-content code {
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.08);
  padding: 0.125rem 0.25rem;
  font-size: 0.75rem;
}

.markdown-content blockquote {
  margin: 0.4em 0;
  padding-left: 0.75em;
  border-left: 3px solid currentColor;
  opacity: 0.8;
}

.markdown-content table {
  border-collapse: collapse;
  margin: 0.4em 0;
}

.markdown-content th,
.markdown-content td {
  border: 1px solid #e5e7eb;
  padding: 0.25em 0.5em;
}
```

<Tip>
  聊天气泡中的 Markdown 样式要保持紧凑。聊天消息比博客文章更小，因此应该使用比常规文章排版更紧凑的间距和更小的字号。
</Tip>

## 最佳实践

* **始终清洗：** 使用 `v-html`、`{@html}` 或 `[innerHTML]` 时，始终先把解析结果交给 `dompurify`。不要信任由 LLM 输出喂给 Markdown 解析器后产生的原始 HTML。
* **启用 GFM：** GitHub Flavored Markdown 增加了表格、删除线、任务列表和自动链接。LLM 经常会使用这些特性。
* **处理空内容：** 解析前检查空字符串，避免渲染空容器。
* **使用 `breaks: true`：** 启用换行转换，让 LLM 输出中的单个换行渲染为 `<br>`，而不是被忽略。LLM 经常用单个换行进行视觉分隔。
* **面向聊天场景设置样式：** 使用适合聊天气泡的紧凑边距和字号，而不是全宽文章布局。
* **用富内容测试：** 使用标题、嵌套列表、带长行的代码块、宽表格和引用块验证渲染效果，以发现溢出或布局问题。

***

<div className="source-links">
  <Callout icon="terminal-2">
    [连接这些文档](/use-these-docs)到 Claude、VSCode 等工具，并通过 MCP 获得实时回答。
  </Callout>

  <Callout icon="edit">
    [在 GitHub 上编辑此页面](https://github.com/langchain-ai/docs/edit/main/src/oss/langchain/frontend/markdown-messages.mdx) 或 [提交 issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>
