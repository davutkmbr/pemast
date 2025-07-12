import { type RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { MemoryService } from "../../services/memory.service.js";
import type { GatewayContext, Memory } from "../../types/index.js";

/**
 * Tool: search_memory
 * Retrieves memories relevant to a user query. Focused on text content only.
 * For file retrieval, use the file_retriever tool instead.
 */
const SearchMemoryParams = z.object({
  query: z.string().describe("User search query. Can be a question or keywords."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Maximum number of results to return (1-20). Optional."),
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
 * Process memories and generate text results
 */
function processMemories(memories: Memory[]): string[] {
  const textResults: string[] = [];

  for (let i = 0; i < memories.length; i++) {
    const memory = memories[i];
    if (!memory) continue; // Safety check

    // Add indicator if memory has a file
    const fileIndicator = memory.fileId ? " [📎 Has file]" : "";
    textResults.push(`${i + 1}. ${memory.content}${fileIndicator}`);
  }

  return textResults;
}

export const searchMemoryTool = tool({
  name: "search_memory",
  description:
    "Returns a list of stored memories that are relevant to the given query. Focuses on text content. For retrieving files, use the file_retriever tool instead.",
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

      if (memories.length === 0) {
        return "No matching memories found.";
      }

      // Process memories and generate response
      const textResults = processMemories(memories);
      const response = textResults.join("\n");

      return response;
    } catch (error) {
      console.error("Error in search memory tool:", error);
      return "⚠️ Error occurred while searching memories.";
    }
  },
});
