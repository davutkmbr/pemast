import { Agent, handoff } from "@openai/agents";
import { z } from "zod";
import { generateReasoningAgentPrompt } from "../../prompts/reasoning-agent.prompt.js";
import type { DatabaseContext } from "../../types/index.js";

/**
 * Reasoning Agent - Main Coordinator
 *
 * Purpose: Strategic thinking and decision making
 * Tools: None (pure reasoning with handoff capabilities)
 *
 * Responsibilities:
 * - Analyze user requests
 * - Decide which specialist agent to engage
 * - Ask clarifying questions
 * - Synthesize final responses
 * - Handle uncertainty and ambiguity
 */

// Empty input type for handoffs that don't need input data
const EmptyHandoffInput = z.object({});

export async function createReasoningAgent(context: DatabaseContext) {
  const instructions = await generateReasoningAgentPrompt(context);

  const model = process.env.MAIN_MODEL;
  if (!model) {
    throw new Error("MAIN_MODEL is not set");
  }

  // Lazy load specialized agents to avoid circular imports
  const getMemoryAgent = async () => {
    const { createMemoryAgent } = await import("./memory-agent.js");
    return createMemoryAgent(context);
  };

  const getValidationAgent = async () => {
    const { createValidationAgent } = await import("./validation-agent.js");
    return createValidationAgent(context);
  };

  const getFileAgent = async () => {
    const { createFileAgent } = await import("./file-agent.js");
    return createFileAgent(context);
  };

  const getPreferenceAgent = async () => {
    const { createPreferenceAgent } = await import("./preference-agent.js");
    return createPreferenceAgent(context);
  };

  const getWebAgent = async () => {
    const { createWebAgent } = await import("./web-agent.js");
    return createWebAgent(context);
  };

  return new Agent({
    name: "reasoning-agent",
    model,
    modelSettings: {
      parallelToolCalls: false, // Sequential reasoning
    },
    instructions,
    // Reasoning agent uses handoffs instead of direct tools
    handoffs: [
      handoff(await getMemoryAgent(), {
        toolNameOverride: "transfer_to_memory",
        toolDescriptionOverride:
          "Handoff to Memory Agent for storing or retrieving information from user's memory",
        inputType: EmptyHandoffInput,
        onHandoff: (ctx) => {
          console.log("🧠 Reasoning Agent → Memory Agent handoff");
          console.log(
            `   Context: ${JSON.stringify({ userId: ctx.context?.userId, timestamp: new Date().toISOString() })}`,
          );
        },
      }),
      handoff(await getValidationAgent(), {
        toolNameOverride: "transfer_to_validation",
        toolDescriptionOverride:
          "Handoff to Validation Agent for checking consistency and detecting conflicts",
        inputType: EmptyHandoffInput,
        onHandoff: (ctx) => {
          console.log("🔍 Reasoning Agent → Validation Agent handoff");
          console.log(
            `   Context: ${JSON.stringify({ userId: ctx.context?.userId, timestamp: new Date().toISOString() })}`,
          );
        },
      }),
      handoff(await getFileAgent(), {
        toolNameOverride: "transfer_to_file",
        toolDescriptionOverride: "Handoff to File Agent for retrieving or managing files and media",
        inputType: EmptyHandoffInput,
        onHandoff: (ctx) => {
          console.log("📁 Reasoning Agent → File Agent handoff");
          console.log(
            `   Context: ${JSON.stringify({ userId: ctx.context?.userId, timestamp: new Date().toISOString() })}`,
          );
        },
      }),
      handoff(await getPreferenceAgent(), {
        toolNameOverride: "transfer_to_preference",
        toolDescriptionOverride:
          "Handoff to Preference Agent for managing user preferences and settings",
        inputType: EmptyHandoffInput,
        onHandoff: (ctx) => {
          console.log("⚙️ Reasoning Agent → Preference Agent handoff");
          console.log(
            `   Context: ${JSON.stringify({ userId: ctx.context?.userId, timestamp: new Date().toISOString() })}`,
          );
        },
      }),
      handoff(await getWebAgent(), {
        toolNameOverride: "transfer_to_web",
        toolDescriptionOverride:
          "Handoff to Web Agent for searching the internet and getting real-time information",
        inputType: EmptyHandoffInput,
        onHandoff: (ctx) => {
          console.log("🌐 Reasoning Agent → Web Agent handoff");
          console.log(
            `   Context: ${JSON.stringify({ userId: ctx.context?.userId, timestamp: new Date().toISOString() })}`,
          );
        },
      }),
    ],
  });
}
