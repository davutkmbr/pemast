import { type RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { reminderService, ReminderService } from "../../services/reminder.service.js";
import type { GatewayContext, Reminder } from "../../types/index.js";

/**
 * Tool: search_reminders
 * Searches for reminders using semantic search, text search, and tag search
 */

const SearchRemindersParams = z.object({
  query: z.string().describe("Search query - can be keywords, description, or tags"),
  limit: z.number().int().min(1).max(20).default(10).describe("Maximum number of results"),
  includeCompleted: z.boolean().default(false).describe("Include completed reminders in results"),
  searchMethods: z
    .array(z.enum(["semantic", "text", "tags"]))
    .default(["semantic", "text", "tags"])
    .describe("Search methods to use"),
});

export type SearchRemindersParams = z.infer<typeof SearchRemindersParams>;

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format recurrence info
 */
function formatRecurrence(reminder: Reminder): string {
  if (!reminder.isRecurring || reminder.recurrenceType === "none" || !reminder.recurrenceType) {
    return "One-time";
  }

  const interval = reminder.recurrenceInterval || 1;
  const intervalText = interval === 1 ? "" : `${interval} `;
  const typeText =
    {
      daily: "günde",
      weekly: "haftada",
      monthly: "ayda",
      yearly: "yılda",
    }[reminder.recurrenceType] || "";

  return `Her ${intervalText}${typeText}`;
}

/**
 * Get status emoji and text
 */
function getStatusInfo(reminder: Reminder): { emoji: string; text: string } {
  if (reminder.isCompleted) {
    return { emoji: "✅", text: "Completed" };
  }

  const now = new Date();
  const scheduled = new Date(reminder.scheduledFor);

  if (scheduled <= now) {
    return { emoji: "🔔", text: "Due now" };
  }

  return { emoji: "⏰", text: "Scheduled" };
}

/**
 * Format a single reminder for display
 */
function formatReminder(reminder: Reminder, index: number): string {
  const statusInfo = getStatusInfo(reminder);
  const scheduledDate = formatDate(new Date(reminder.scheduledFor));
  const recurrenceInfo = formatRecurrence(reminder);
  const tags = reminder.tags && reminder.tags.length > 0 ? ` [${reminder.tags.join(", ")}]` : "";

  return `${index + 1}. ${statusInfo.emoji} **${reminder.content}**
   📅 ${scheduledDate} | 🔄 ${recurrenceInfo} | 📋 ${statusInfo.text}${tags}`;
}

/**
 * Search reminders using the service
 */
async function searchReminders(
  params: SearchRemindersParams,
  context: GatewayContext,
): Promise<{
  results: Reminder[];
  searchInfo: string;
}> {
  // Use the comprehensive search method
  const searchResults = await reminderService.findReminders(
    params.query,
    context.userId,
    context.projectId,
    {
      limit: params.limit,
      includeCompleted: params.includeCompleted,
      searchMethods: params.searchMethods,
    },
  );

  // Generate search info
  const searchInfo = `
🔍 **Search Summary**
- Query: "${params.query}"
- Methods: ${params.searchMethods.join(", ")}
- Semantic: ${searchResults.semantic.length} results
- Text: ${searchResults.text.length} results  
- Tags: ${searchResults.tags.length} results
- Combined: ${searchResults.combined.length} results`;

  return {
    results: searchResults.combined,
    searchInfo,
  };
}

/**
 * Generate the response message
 */
function generateResponse(results: Reminder[], searchInfo: string, query: string): string {
  if (results.length === 0) {
    return `🔍 **No reminders found**

${searchInfo}

No reminders match your search criteria: "${query}"

You can try:
- Using different keywords
- Including completed reminders
- Creating a new reminder if needed`;
  }

  const formattedResults = results
    .map((reminder, index) => formatReminder(reminder, index))
    .join("\n\n");

  return `🔍 **Found ${results.length} reminder(s)**

${formattedResults}

${searchInfo}

💡 **Tip**: Use reminder IDs for more actions like canceling or updating reminders.`;
}

export const searchRemindersTool = tool({
  name: "search_reminders",
  description: `Searches for reminders using multiple search methods.

Features:
- **Semantic search**: Finds reminders by meaning and context
- **Text search**: Matches keywords in content and summary
- **Tag search**: Filters by tags and categories
- **Combined results**: Deduplicates and ranks results
- **Flexible filtering**: Include/exclude completed reminders

Use cases:
- "Find reminders about mom" 
- "Show upcoming birthday reminders"
- "Search for work-related reminders"
- "Find daily medication reminders"

The tool shows status, schedule, recurrence, and tags for each reminder.`,
  parameters: SearchRemindersParams,
  strict: true,
  execute: async (data: SearchRemindersParams, runContext?: RunContext<GatewayContext>) => {
    const context = runContext?.context;
    if (!context) {
      return "⚠️ Missing database context; cannot search reminders.";
    }

    try {
      const { results, searchInfo } = await searchReminders(data, context);
      return generateResponse(results, searchInfo, data.query);
    } catch (error) {
      console.error("Error searching reminders:", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ **Failed to search reminders**

Error: ${errorMessage}

Please try again with a different query.`;
    }
  },
});
