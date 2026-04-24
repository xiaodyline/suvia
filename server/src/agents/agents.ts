import { createAgent } from "langchain";
// import { MemorySaver } from "@langchain/langgraph";
import { model } from "../models/model.ts"

export const agent = createAgent({
  model: model,
  tools: [],
  // checkpointer: new MemorySaver(),
});