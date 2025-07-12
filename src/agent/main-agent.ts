import { Agent, webSearchTool } from "@openai/agents";
import { buildSystemPrompt } from "../utils/prompts.js";
import { readFile } from "../utils/read-file.js";
import { fileRetrieverTool } from "./tools/file-retriever.tool.js";
import { searchMemoryTool } from "./tools/search-memory.tool.js";
import { storeMemoryTool } from "./tools/store-memory.tool.js";

async function createMainAgent(personalContext?: string) {
  const baseInstructions = await readFile("prompts/main-agent.md");
  const instructions = buildSystemPrompt(baseInstructions, personalContext);

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
    tools: [searchMemoryTool, storeMemoryTool, fileRetrieverTool],
  });
}

// Export the default agent without personal context for backwards compatibility
export const mainAgent = await createMainAgent();

// Export the factory function for creating agents with personal context
export { createMainAgent };
