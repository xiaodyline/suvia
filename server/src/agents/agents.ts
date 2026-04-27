import { createAgent } from "langchain";
// import { MemorySaver } from "@langchain/langgraph";
import { model } from "../models/model.ts"

export const agent = createAgent({
  model: model,
  tools: [{ type: "image_generation" }], // 添加画图工具
  // checkpointer: new MemorySaver(),
});