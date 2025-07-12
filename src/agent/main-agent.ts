import { Agent, webSearchTool } from "@openai/agents";
import { generateMainAgentPrompt } from "../prompts/main-agent.prompt.js";
import type { DatabaseContext } from "../types/index.js";
import { fileRetrieverTool } from "./tools/file-retriever.tool.js";
import { searchMemoryTool } from "./tools/search-memory.tool.js";
import { setUserPreferenceTool } from "./tools/set-user-preference.tool.js";
import { storeMemoryTool } from "./tools/store-memory.tool.js";

export async function createMainAgent(context: DatabaseContext) {
  const instructions = await generateMainAgentPrompt(context);

  const model = process.env.MAIN_MODEL;
  if (!model) {
    throw new Error("MAIN_MODEL is not set");
  }

  return new Agent({
    name: "main-agent",
    model,
    modelSettings: {
      parallelToolCalls: true,
    },
    instructions,
    tools: [
      webSearchTool(),
      searchMemoryTool,
      storeMemoryTool,
      setUserPreferenceTool,
      fileRetrieverTool,
    ],
  });
}
