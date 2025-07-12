import type { DatabaseContext } from "../types/index.js";
import { createReasoningAgent } from "./agents/reasoning-agent.js";

/**
 * Creates the main multi-agent system using the Reasoning Agent as coordinator
 *
 * The new architecture uses specialized agents:
 * - Reasoning Agent: Main coordinator and strategic thinking
 * - Memory Agent: Information storage and retrieval
 * - Validation Agent: Consistency checking and conflict detection
 * - File Agent: Document and media operations
 * - Preference Agent: User settings management
 * - Web Agent: Real-time information gathering
 */

export async function createMainAgent(context: DatabaseContext) {
  // Create the reasoning agent which will coordinate all other specialized agents
  const reasoningAgent = await createReasoningAgent(context);

  console.log("🚀 Enhanced Multi-Agent System Initialized.");

  return reasoningAgent;
}
