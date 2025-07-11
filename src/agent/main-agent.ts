import { Agent, webSearchTool } from "@openai/agents";
import { storeMemoryTool } from "./tools/store-memory.tool";
import { searchMemoryTool } from "./tools/search-memory.tool";

export const mainAgent = new Agent({
  name: "main-agent",
  model: "gpt-4o-mini",
  modelSettings: {
    parallelToolCalls: true,
  },
  instructions: `You are Pemast, a personal assistant. Use the tools provided to fulfil the user's requests. Be concise; prefer Turkish if the user speaks Turkish.`,
  tools: [
    searchMemoryTool,
    storeMemoryTool,
    webSearchTool()
  ]
});
