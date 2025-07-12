import { Agent, webSearchTool } from "@openai/agents";
import { storeMemoryTool } from "./tools/store-memory.tool.js";
import { searchMemoryTool } from "./tools/search-memory.tool.js";
import { readFile } from "../utils/read-file.js";
import { buildSystemPrompt } from "../utils/prompts.js";

async function createMainAgent(personalContext?: string) {
  const baseInstructions = await readFile('prompts/main-agent.md');
  const instructions = buildSystemPrompt(baseInstructions, personalContext);

  return new Agent({
    name: "main-agent",
    model: "gpt-4.1",
    modelSettings: {
      parallelToolCalls: true,
    },
    instructions,
    tools: [
      searchMemoryTool,
      storeMemoryTool,
      webSearchTool()
    ]
  });
}

// Export the default agent without personal context for backwards compatibility
export const mainAgent = await createMainAgent();

// Export the factory function for creating agents with personal context
export { createMainAgent };
