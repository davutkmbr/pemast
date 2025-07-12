import { Agent } from "@openai/agents";
import { z } from "zod";
import { generateReasoningAgentPrompt } from "../../prompts/reasoning-agent.prompt.js";
import type { DatabaseContext } from "../../types/index.js";

/**
 * Reasoning Agent - Main Coordinator
 *
 * Purpose: Strategic thinking, planning, and execution coordination
 * Tools: Planning agent + specialized agent tools
 *
 * Responsibilities:
 * - Create execution plans for user messages
 * - Execute planned tasks sequentially
 * - Handle conditional flows and user clarification
 * - Coordinate multiple specialist agents
 * - Maintain conversation context and flow
 * - Synthesize final responses
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

  // Create specialized agents as tools to maintain reasoning agent control
  const getConversationManagerTool = async () => {
    const { createConversationManagerAgent } = await import("./conversation-manager-agent.js");
    const conversationManager = await createConversationManagerAgent(context);
    return conversationManager.asTool({
      toolName: "analyze_conversation",
      toolDescription:
        "Analyze conversation context and determine appropriate response style (casual chat vs task-focused). Use this to understand how to respond naturally to the user.",
    });
  };

  const getMemoryAgentTool = async () => {
    const { createMemoryAgent } = await import("./memory-agent.js");
    const memoryAgent = await createMemoryAgent(context);
    return memoryAgent.asTool({
      toolName: "manage_memory",
      toolDescription:
        "Store or retrieve information from user's memory. Use this when user shares new information or asks about past conversations/data.",
    });
  };

  const getValidationAgentTool = async () => {
    const { createValidationAgent } = await import("./validation-agent.js");
    const validationAgent = await createValidationAgent(context);
    return validationAgent.asTool({
      toolName: "validate_information",
      toolDescription:
        "Check for conflicts, contradictions, and consistency issues with new information. Use this before storing important information to avoid conflicts.",
    });
  };

  const getFileAgentTool = async () => {
    const { createFileAgent } = await import("./file-agent.js");
    const fileAgent = await createFileAgent(context);
    return fileAgent.asTool({
      toolName: "manage_files",
      toolDescription:
        "Retrieve, search, or manage user files and media. Use this when user asks about files, documents, or uploaded content.",
    });
  };

  const getPreferenceAgentTool = async () => {
    const { createPreferenceAgent } = await import("./preference-agent.js");
    const preferenceAgent = await createPreferenceAgent(context);
    return preferenceAgent.asTool({
      toolName: "manage_preferences",
      toolDescription:
        "Handle user preferences and settings changes. Use this when user wants to change language, behavior, or other settings.",
    });
  };

  const getWebAgentTool = async () => {
    const { createWebAgent } = await import("./web-agent.js");
    const webAgent = await createWebAgent(context);
    return webAgent.asTool({
      toolName: "search_web",
      toolDescription:
        "Search the internet for real-time information. Use this when user asks about current events, news, or information not in memory.",
    });
  };

  return new Agent({
    name: "reasoning-agent",
    model,
    modelSettings: {
      parallelToolCalls: false, // Sequential execution based on plan
    },
    instructions: `${instructions}

## EXECUTION WORKFLOW

### 🎯 PRIMARY WORKFLOW
For EVERY user message, follow this workflow:

1. **PLANNING PHASE**: 
   - Use create_task_plan to analyze user message and create execution plan
   - Review the plan to understand: task sequence, conditional flows, user clarification points

2. **EXECUTION PHASE**:
   - Execute tasks sequentially according to the plan
   - Handle conditional tasks based on previous results
   - Stop and ask for user clarification when plan indicates USER_CLARIFICATION_REQUIRED
   - Continue execution after receiving clarification

3. **RESPONSE PHASE**:
   - When plan reaches FINAL_RESPONSE, synthesize natural response
   - Include results from all executed tasks
   - Maintain conversation flow and personality

### 🔄 CONDITIONAL EXECUTION HANDLING

**When executing conditional tasks:**
- Check if conditions are met based on previous task results
- Skip tasks whose conditions are not satisfied
- Follow alternative flows as specified in plan

**When USER_CLARIFICATION_REQUIRED:**
- Stop execution immediately
- Ask the specific question provided in the plan
- Wait for user response before continuing
- Resume from the appropriate step after clarification

### 📋 TASK EXECUTION MAPPING
- validate_information → use validate_information tool
- manage_memory → use manage_memory tool  
- manage_files → use manage_files tool
- manage_preferences → use manage_preferences tool
- search_web → use search_web tool
- analyze_conversation → use analyze_conversation tool
- USER_CLARIFICATION_REQUIRED → ask user directly
- FINAL_RESPONSE → synthesize and respond

### 🎪 EXECUTION EXAMPLES

**Example Flow 1: Simple casual chat**
User: "bugün çok yoruldum"
1. create_task_plan → Plan: [analyze_conversation, FINAL_RESPONSE]
2. analyze_conversation → Get casual empathetic style guidance
3. FINAL_RESPONSE → "off yine mi zor gün geçirdin!"

**Example Flow 2: Complex information with clarification**
User: "ahmet'in kan grubu a+"
1. create_task_plan → Plan: [validate_information, USER_CLARIFICATION_REQUIRED, manage_memory, analyze_conversation, FINAL_RESPONSE]
2. validate_information → "Ambiguous reference to Ahmet"
3. USER_CLARIFICATION_REQUIRED → "Hangi Ahmet'i kastediyorsun? Tam adı nedir?"
4. [Wait for user response: "Ahmet Tümer - arkadaşım"]
5. manage_memory → Store blood type info for Ahmet Tümer
6. analyze_conversation → Get confirmation style
7. FINAL_RESPONSE → "anladım! ahmet tümer'in kan grubunu kaydettim 👍"

### 🎯 KEY PRINCIPLES
- **Always plan first**: Never execute without understanding the full context
- **Follow the plan**: Execute tasks in the planned sequence
- **Handle conditions**: Check and respect conditional logic
- **User clarification**: Stop and ask when plan requires it
- **Natural flow**: Keep responses conversational and friendly
- **Context retention**: Remember conversation context throughout execution`,
    // Planning agent as first tool, then execution tools
    tools: [
      await getPlanningAgentTool(),
      await getConversationManagerTool(),
      await getMemoryAgentTool(),
      await getValidationAgentTool(),
      await getFileAgentTool(),
      await getPreferenceAgentTool(),
      await getWebAgentTool(),
    ],
  });
}
