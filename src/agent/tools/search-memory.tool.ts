import { tool } from "@openai/agents";
import { z } from "zod";
import { MemoryService } from "../../services/memory.service.js";
import type { DatabaseContext, Memory } from "../../types/index.js";

/**
 * Tool: search_memory
 * Retrieves memories relevant to a user query. Intended for RAG retrieval.
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

export const searchMemoryTool = tool({
  name: "search_memory",
  description: "Returns a list of stored memories that are relevant to the given query.",
  parameters: SearchMemoryParams,
  strict: true,
  execute: async (data: z.infer<typeof SearchMemoryParams>, context) => {
    const dbCtx = (context as any)?.context as DatabaseContext | undefined;
    if (!dbCtx) {
      return "⚠️ Missing database context; cannot search memories.";
    }

    const memoryService = new MemoryService();
    const { query, limit } = data;

    // For now use semantic + text search combined util
    const results = await memoryService.findMemories(query, dbCtx.userId, dbCtx.projectId, {
      limit,
      searchMethods: ["semantic", "text"],
    });

    // Build human-readable output (top combined results)
    const combined: Memory[] = results.combined.slice(0, limit);
    if (combined.length === 0) return "No matching memories found.";

    // const lines = combined.map((m, i) => `${i + 1}. ${m.summary ?? m.content.slice(0, 80)}`);
    const lines = combined.map((m, i) => `${i + 1}. ${m.content}`);
    return lines.join("\n");
  },
});
