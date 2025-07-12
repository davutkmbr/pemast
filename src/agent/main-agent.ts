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

  console.log("🚀 Multi-Agent System Initialized:");
  console.log("   🧠 Reasoning Agent - Strategic Coordinator");
  console.log("   💾 Memory Agent - Information Specialist");
  console.log("   🔍 Validation Agent - Consistency Guardian");
  console.log("   📁 File Agent - Document Specialist");
  console.log("   ⚙️ Preference Agent - Settings Specialist");
  console.log("   🌐 Web Agent - Research Specialist");

  return reasoningAgent;
}
