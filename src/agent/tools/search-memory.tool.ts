import { type RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { MemoryService } from "../../services/memory.service.js";
import type { GatewayContext, Memory } from "../../types/index.js";

/**
 * Tool: search_memory
 * Retrieves memories relevant to a user query. Enhanced for ambiguous reference detection.
 * Provides detailed analysis for Memory Agent decision making.
 */
const SearchMemoryParams = z.object({
  query: z.string().describe("User search query. Can be a question, keywords, or person's name."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .describe("Maximum number of results to return (1-20). Optional."),
  context: z
    .string()
    .nullish()
    .describe("Additional context about what you're looking for (optional)."),
});

export type SearchMemoryParams = z.infer<typeof SearchMemoryParams>;

/**
 * Search for memories in the database
 */
async function searchMemories(
  query: string,
  userId: string,
  projectId: string,
  limit: number,
): Promise<Memory[]> {
  const memoryService = new MemoryService();

  const results = await memoryService.findMemories(query, userId, projectId, {
    limit,
    searchMethods: ["semantic", "text"],
  });

  return results.combined.slice(0, limit);
}

/**
 * Analyze search results for ambiguous references
 */
function analyzeAmbiguousReferences(
  query: string,
  memories: Memory[],
): {
  isAmbiguous: boolean;
  analysis: string;
  matches: Array<{ name: string; details: string; memoryId: string }>;
} {
  const queryLower = query.toLowerCase();

  // Check if query is a simple first name that might be ambiguous
  const isSimpleFirstName = /^[a-zA-ZçğıöşüÇĞIİÖŞÜ]+$/.test(queryLower) && queryLower.length > 2;

  if (!isSimpleFirstName || memories.length <= 1) {
    return {
      isAmbiguous: false,
      analysis: `Clear reference - ${memories.length} matches found`,
      matches: [],
    };
  }

  // Extract person matches from memories
  const personMatches: Array<{ name: string; details: string; memoryId: string }> = [];

  for (const memory of memories) {
    const content = memory.content.toLowerCase();

    // Look for the query name in the content
    if (content.includes(queryLower)) {
      // Try to extract more specific information
      let personDetails = memory.content;
      if (memory.summary) {
        personDetails += ` (${memory.summary})`;
      }

      // Add tags context
      if (memory.tags && memory.tags.length > 0) {
        const relevantTags = memory.tags.filter((tag) => !["personal_info", "note"].includes(tag));
        if (relevantTags.length > 0) {
          personDetails += ` [Tags: ${relevantTags.join(", ")}]`;
        }
      }

      personMatches.push({
        name: queryLower,
        details: personDetails,
        memoryId: memory.id,
      });
    }
  }

  const isAmbiguous = personMatches.length > 1;

  return {
    isAmbiguous,
    analysis: isAmbiguous
      ? `Ambiguous reference: ${personMatches.length} different people named "${query}" found`
      : `Clear reference: Only one person named "${query}" found`,
    matches: personMatches,
  };
}

/**
 * Process memories and generate enhanced results with ambiguity analysis
 */
function processMemoriesWithAnalysis(
  query: string,
  memories: Memory[],
): {
  textResults: string[];
  ambiguityAnalysis: ReturnType<typeof analyzeAmbiguousReferences>;
} {
  const textResults: string[] = [];

  for (let i = 0; i < memories.length; i++) {
    const memory = memories[i];
    if (!memory) continue;

    // Add indicator if memory has a file
    const fileIndicator = memory.fileId ? " [📎 Has file]" : "";

    // Add memory date if available
    const dateInfo = memory.createdAt
      ? ` (${new Date(memory.createdAt).toLocaleDateString()})`
      : "";

    textResults.push(`${i + 1}. ${memory.content}${fileIndicator}${dateInfo}`);
  }

  const ambiguityAnalysis = analyzeAmbiguousReferences(query, memories);

  return { textResults, ambiguityAnalysis };
}

/**
 * Generate enhanced response for Memory Agent
 */
function generateEnhancedResponse(
  query: string,
  memories: Memory[],
  textResults: string[],
  ambiguityAnalysis: ReturnType<typeof analyzeAmbiguousReferences>,
): string {
  if (memories.length === 0) {
    return `🔍 **SEARCH RESULTS**
- **Query**: "${query}"
- **Found**: No matching memories
- **Analysis**: No existing information about "${query}"
- **Recommendation**: Safe to proceed with new information storage`;
  }

  let response = `🔍 **SEARCH RESULTS**
- **Query**: "${query}"
- **Found**: ${memories.length} matching memories
- **Analysis**: ${ambiguityAnalysis.analysis}

📋 **MEMORIES FOUND:**
${textResults.join("\n")}`;

  if (ambiguityAnalysis.isAmbiguous) {
    response += `

⚠️ **AMBIGUITY DETECTED**
- **Issue**: Multiple people with same name "${query}"
- **Matches Found**:`;

    ambiguityAnalysis.matches.forEach((match, index) => {
      response += `\n  ${index + 1}. ${match.details}`;
    });

    response += `
- **Recommendation**: Request clarification from user
- **Suggested Question**: "Hangi ${query}'i kastediyorsun? Tam adı ve ilişkiniz nedir?"`;
  } else if (memories.length === 1 && memories[0]) {
    response += `

✅ **CLEAR REFERENCE**
- **Person**: Clearly identified
- **Context**: ${memories[0].content}
- **Recommendation**: Safe to add new information about this person`;
  }

  return response;
}

export const searchMemoryTool = tool({
  name: "search_memory",
  description: `Enhanced memory search tool that:
- Searches for stored memories using semantic and text matching
- Detects ambiguous references (multiple people with same name)
- Provides detailed analysis for Memory Agent decision making
- Recommends clarification when needed
- Focuses on text content (use file_retriever for files)`,
  parameters: SearchMemoryParams,
  strict: true,
  execute: async (data: SearchMemoryParams, runContext?: RunContext<GatewayContext>) => {
    const context = runContext?.context;
    if (!context) {
      return "⚠️ Missing database context; cannot search memories.";
    }

    try {
      // Search for memories
      const memories = await searchMemories(
        data.query,
        context.userId,
        context.projectId,
        data.limit,
      );

      // Process with enhanced analysis
      const { textResults, ambiguityAnalysis } = processMemoriesWithAnalysis(data.query, memories);

      // Generate enhanced response for Memory Agent
      const response = generateEnhancedResponse(
        data.query,
        memories,
        textResults,
        ambiguityAnalysis,
      );

      return response;
    } catch (error) {
      console.error("Error in search memory tool:", error);
      return "⚠️ Error occurred while searching memories.";
    }
  },
});
