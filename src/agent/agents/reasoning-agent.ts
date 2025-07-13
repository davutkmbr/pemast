import { Agent, webSearchTool } from "@openai/agents";
import type { DatabaseContext } from "../../types/index.js";
import { generateReasoningAgentPrompt } from "../prompts/reasoning-agent.prompt.js";
import { cancelReminderTool } from "../tools/cancel-reminder.tool.js";
import { createReminderTool } from "../tools/create-reminder.tool.js";
import { fileRetrieverTool } from "../tools/file-retriever.tool.js";
import { listUpcomingRemindersTool } from "../tools/list-upcoming-reminders.tool.js";
import { searchMemoryTool } from "../tools/search-memory.tool.js";
import { searchRemindersTool } from "../tools/search-reminders.tool.js";
import { setUserPreferenceTool } from "../tools/set-user-preference.tool.js";
import { storeMemoryTool } from "../tools/store-memory.tool.js";

/**
 * Reasoning Agent - Unified Tool-Based Architecture
 *
 * Purpose: Strategic thinking, planning, and direct task execution
 * Architecture: Single agent with comprehensive toolset
 *
 * Responsibilities:
 * - Create execution plans for user messages
 * - Execute tasks directly using specialized tools
 * - Handle conditional flows and user clarification
 * - Maintain conversation context and natural flow
 * - Synthesize final responses
 *
 * Key Features:
 * - Single model call for all operations
 * - Direct tool usage without agent intermediaries
 * - Reduced token usage and faster execution
 * - Comprehensive planning-first approach
 * - Natural conversation flow prioritization
 */

export async function createReasoningAgent(context: DatabaseContext) {
  const instructions = await generateReasoningAgentPrompt(context);

  const model = process.env.MAIN_MODEL;
  if (!model) {
    throw new Error("MAIN_MODEL is not set");
  }

  // Create planning agent as primary coordination tool
  const getPlanningAgentTool = async () => {
    const { createPlanningAgent } = await import("./planning-agent.js");
    const planningAgent = await createPlanningAgent(context);
    return planningAgent.asTool({
      toolName: "create_task_plan",
      toolDescription:
        "Analyze user message and create a detailed, sequential task execution plan. Use this FIRST for every user message to understand what needs to be done and in what order.",
    });
  };

  return new Agent({
    name: "reasoning-agent",
    model,
    modelSettings: {
      parallelToolCalls: false, // Sequential execution based on plan
    },
    instructions,

    // Direct tools - comprehensive toolset for all tasks
    tools: [
      await getPlanningAgentTool(),
      searchMemoryTool,
      storeMemoryTool,
      fileRetrieverTool,
      setUserPreferenceTool,
      createReminderTool,
      searchRemindersTool,
      cancelReminderTool,
      listUpcomingRemindersTool,
      webSearchTool(),
    ],
  });
}
