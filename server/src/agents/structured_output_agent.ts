import * as z from "zod";
import { createAgent, providerStrategy } from "langchain";
import { model } from "../models/model.ts"

const ContactInfo = z.object({
  name: z.string().describe("The name of the person"),
  email: z.string().describe("The email address of the person"),
  phone: z.string().describe("The phone number of the person"),
});

export const agent = createAgent({
  model: model,
  tools: [],
  responseFormat: providerStrategy(ContactInfo)
});

const result = await agent.invoke({
  messages: [{ "role": "user", "content": "Extract contact info from: John Doe, john@example.com, (555) 123-4567" }]
});

console.log(result.structuredResponse);
// { name: "John Doe", email: "john@example.com", phone: "(555) 123-4567" }