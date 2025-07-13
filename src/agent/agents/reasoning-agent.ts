import { Agent, webSearchTool } from "@openai/agents";
import type { DatabaseContext } from "../../types/index.js";
import { generateReasoningAgentPrompt } from "../prompts/reasoning-agent.prompt.js";
import { fileRetrieverTool } from "../tools/file-retriever.tool.js";
import { searchMemoryTool } from "../tools/search-memory.tool.js";
import { setUserPreferenceTool } from "../tools/set-user-preference.tool.js";
import { storeMemoryTool } from "../tools/store-memory.tool.js";

/**
 * Reasoning Agent - Optimized Single Agent
 *
 * Purpose: Strategic thinking, planning, and direct execution
 * Tools: Planning agent + all direct tools (no intermediate agents)
 *
 * Responsibilities:
 * - Create execution plans for user messages
 * - Execute tasks directly using tools
 * - Handle conditional flows and user clarification
 * - Maintain conversation context and flow
 * - Synthesize final responses
 *
 * OPTIMIZATIONS:
 * - No agent-to-agent communication overhead
 * - Single model call for all operations
 * - Reduced token usage
 * - Faster execution
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
    instructions: `${instructions}

## EXECUTION WORKFLOW

### 🎯 PRIMARY WORKFLOW
For EVERY user message, follow this workflow:

1. **PLANNING PHASE**: 
   - Use create_task_plan to analyze user message and create execution plan
   - Review the plan to understand: task sequence, conditional flows, user clarification points

2. **EXECUTION PHASE**:
   - Execute tasks sequentially according to the plan using direct tools
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
- validate_information → use search_memory tool to check for conflicts/ambiguity
- manage_memory → use search_memory and store_memory tools
- manage_files → use file_retriever tool
- manage_preferences → use set_user_preference tool
- search_web → use web_search tool
- analyze_conversation → analyze context and determine response style directly
- USER_CLARIFICATION_REQUIRED → ask user directly
- FINAL_RESPONSE → synthesize and respond

### 🎪 EXECUTION EXAMPLES

**Example Flow 1: Simple casual chat**
User: "bugün çok yoruldum"
1. create_task_plan → Plan: [analyze_conversation, FINAL_RESPONSE]
2. analyze_conversation → Determine casual empathetic style internally
3. FINAL_RESPONSE → "off yine mi zor gün geçirdin!"

**Example Flow 2: Complex information with clarification**
User: "ahmet'in kan grubu a+"
1. create_task_plan → Plan: [validate_information, USER_CLARIFICATION_REQUIRED, manage_memory, analyze_conversation, FINAL_RESPONSE]
2. search_memory → Check for "ahmet" → Find ambiguity
3. USER_CLARIFICATION_REQUIRED → "Hangi Ahmet'i kastediyorsun? Tam adı nedir?"
4. [Wait for user response: "Ahmet Tümer - arkadaşım"]
5. store_memory → Store blood type info for Ahmet Tümer
6. analyze_conversation → Determine confirmation style internally
7. FINAL_RESPONSE → "anladım! ahmet tümer'in kan grubunu kaydettim 👍"

**Example Flow 3: File request**
User: "geçen hafta çektiğim fotoğrafları göster"
1. create_task_plan → Plan: [manage_files, analyze_conversation, FINAL_RESPONSE]
2. file_retriever → Search and send photos from last week
3. analyze_conversation → Determine casual response style
4. FINAL_RESPONSE → "işte geçen haftanın fotoğrafları! hangi gün çekmiştin bunları?"

**Example Flow 4: Preference change**
User: "artık ingilizce konuş"
1. create_task_plan → Plan: [manage_preferences, analyze_conversation, FINAL_RESPONSE]
2. set_user_preference → Set language to English
3. analyze_conversation → Determine confirmation style
4. FINAL_RESPONSE → "Got it! I'll speak English from now on."

**Example Flow 5: Web search**
User: "istanbul'da hava nasıl?"
1. create_task_plan → Plan: [search_web, analyze_conversation, FINAL_RESPONSE]
2. web_search → Get current weather in Istanbul
3. analyze_conversation → Determine casual response style
4. FINAL_RESPONSE → "şu an istanbul'da 18°C, hafif bulutlu. dışarı çıkmak için iyi hava!"

### 🛠️ TOOL USAGE GUIDELINES

**search_memory:**
- Use to find existing information
- Check for conflicts before storing new info
- Detect ambiguous references (multiple people with same name)
- Search broadly first, then narrow down

**store_memory:**
- Store new information after validation
- Break complex messages into separate memories
- Use English for consistency
- Add appropriate tags for categorization

**file_retriever:**
- Search for files by content or description
- Files are automatically sent to user
- Can search various file types (images, documents, audio, video)

**set_user_preference:**
- Update user settings and preferences
- Validate preference values
- Handle multiple preferences at once

**web_search:**
- Get real-time information
- Verify facts and current events
- Research topics not in memory

**analyze_conversation (internal):**
- Determine if response should be casual or task-focused
- Match user's communication style
- Keep responses natural and conversational
- Avoid over-formal language in casual contexts

### 🎯 KEY PRINCIPLES
- **Always plan first**: Never execute without understanding the full context
- **Follow the plan**: Execute tasks in the planned sequence using direct tools
- **Handle conditions**: Check and respect conditional logic
- **User clarification**: Stop and ask when plan requires it
- **Natural flow**: Keep responses conversational and friendly
- **Context retention**: Remember conversation context throughout execution
- **Efficiency**: Use tools directly without agent intermediaries`,

    // Direct tools - no agent intermediaries
    tools: [
      await getPlanningAgentTool(),
      searchMemoryTool,
      storeMemoryTool,
      fileRetrieverTool,
      setUserPreferenceTool,
      webSearchTool(),
    ],
  });
}
