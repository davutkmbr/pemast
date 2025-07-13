import { and, eq, gt, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { reminders } from "../db/schema.js";
import type {
  CreateReminderInput,
  DatabaseContext,
  RecurrenceType,
  Reminder,
  VectorSearchResult,
} from "../types/index.js";
import { vectorSearch } from "../utils/vector-search.js";
import { embeddingService } from "./embedding.service.js";
import { notificationService } from "./notification.service.js";

/**
 * Service for managing reminders and recurring reminder logic
 */
export class ReminderService {
  /**
   * Create a new reminder (one-time or recurring) with semantic search support
   */
  async createReminder(input: CreateReminderInput, context: DatabaseContext): Promise<string> {
    try {
      const isRecurring = input.recurrence && input.recurrence.type !== "none";

      // Generate embedding for semantic search using the generic service
      const searchText = embeddingService.combineFieldsForEmbedding([
        input.content,
        input.summary,
        ...(input.tags || []),
      ]);

      const embedding = await embeddingService.generateEmbedding(searchText);

      const [savedReminder] = await db
        .insert(reminders)
        .values({
          projectId: context.projectId,
          userId: context.userId,
          messageId: input.messageId,
          content: input.content,
          scheduledFor: input.scheduledFor,
          summary: input.summary,
          tags: input.tags,
          embedding: embedding.length > 0 ? embedding : null,
          recurrenceType: input.recurrence?.type || "none",
          recurrenceInterval: input.recurrence?.interval || 1,
          recurrenceEndDate: input.recurrence?.endDate,
          isRecurring: isRecurring || false,
        })
        .returning({ id: reminders.id });

      if (!savedReminder) {
        throw new Error("Failed to create reminder - no result returned");
      }

      console.log(`Created ${isRecurring ? "recurring" : "one-time"} reminder:`, {
        id: savedReminder.id,
        summary: input.summary,
        scheduledFor: input.scheduledFor,
        recurrence: input.recurrence,
      });

      return savedReminder.id;
    } catch (error) {
      console.error("Error creating reminder:", error);
      throw new Error(
        `Failed to create reminder: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get all due reminders (scheduled_for <= now and not completed)
   */
  async getDueReminders(): Promise<Reminder[]> {
    try {
      const now = new Date();

      const dueReminders = await db.query.reminders.findMany({
        where: and(lte(reminders.scheduledFor, now), eq(reminders.isCompleted, false)),
        with: {
          user: true,
          project: true,
          message: true,
        },
      });

      return dueReminders;
    } catch (error) {
      console.error("Error fetching due reminders:", error);
      throw new Error(
        `Failed to fetch due reminders: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Process a due reminder (send notification and handle recurrence)
   */
  async processDueReminder(reminderId: string): Promise<{
    action: "completed" | "rescheduled" | "ended";
    nextScheduledFor?: Date;
  }> {
    try {
      // Get the reminder with all details
      const reminder = await db.query.reminders.findFirst({
        where: eq(reminders.id, reminderId),
      });

      if (!reminder) {
        throw new Error(`Reminder not found: ${reminderId}`);
      }

      // If it's not recurring, just mark as completed
      if (!reminder.isRecurring || reminder.recurrenceType === "none") {
        await db
          .update(reminders)
          .set({
            isCompleted: true,
            completedAt: new Date(),
          })
          .where(eq(reminders.id, reminderId));

        return { action: "completed" };
      }

      // Calculate next occurrence for recurring reminders
      const nextOccurrence = this.calculateNextOccurrence(
        reminder.scheduledFor!,
        reminder.recurrenceType as RecurrenceType,
        reminder.recurrenceInterval || 1,
      );

      // Check if we've reached the end date
      if (reminder.recurrenceEndDate && nextOccurrence > reminder.recurrenceEndDate) {
        await db
          .update(reminders)
          .set({
            isCompleted: true,
            completedAt: new Date(),
          })
          .where(eq(reminders.id, reminderId));

        return { action: "ended" };
      }

      // Update to next occurrence
      await db
        .update(reminders)
        .set({
          scheduledFor: nextOccurrence,
        })
        .where(eq(reminders.id, reminderId));

      return {
        action: "rescheduled",
        nextScheduledFor: nextOccurrence,
      };
    } catch (error) {
      console.error("Error processing due reminder:", error);
      throw new Error(
        `Failed to process reminder: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Calculate the next occurrence for a recurring reminder
   */
  private calculateNextOccurrence(
    currentDate: Date,
    recurrenceType: RecurrenceType,
    interval: number,
  ): Date {
    const nextDate = new Date(currentDate);

    switch (recurrenceType) {
      case "daily":
        nextDate.setDate(nextDate.getDate() + interval);
        break;

      case "weekly":
        nextDate.setDate(nextDate.getDate() + 7 * interval);
        break;

      case "monthly":
        nextDate.setMonth(nextDate.getMonth() + interval);
        break;

      case "yearly":
        nextDate.setFullYear(nextDate.getFullYear() + interval);
        break;

      default:
        throw new Error(`Unsupported recurrence type: ${recurrenceType}`);
    }

    return nextDate;
  }

  /**
   * Get upcoming reminders for a user
   */
  async getUpcomingReminders(
    userId: string,
    projectId: string,
    limit: number = 10,
  ): Promise<Reminder[]> {
    try {
      const now = new Date();

      return await db.query.reminders.findMany({
        where: and(
          eq(reminders.userId, userId),
          eq(reminders.projectId, projectId),
          gt(reminders.scheduledFor, now),
          eq(reminders.isCompleted, false),
        ),
        orderBy: reminders.scheduledFor,
        limit,
      });
    } catch (error) {
      console.error("Error fetching upcoming reminders:", error);
      throw new Error(
        `Failed to fetch upcoming reminders: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Cancel a reminder
   */
  async cancelReminder(reminderId: string): Promise<void> {
    try {
      await db
        .update(reminders)
        .set({
          isCompleted: true,
          completedAt: new Date(),
        })
        .where(eq(reminders.id, reminderId));
    } catch (error) {
      console.error("Error canceling reminder:", error);
      throw new Error(
        `Failed to cancel reminder: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get all reminders for a specific message (useful for recurring series)
   */
  async getRemindersByMessage(messageId: string): Promise<Reminder[]> {
    try {
      return await db.query.reminders.findMany({
        where: eq(reminders.messageId, messageId),
        orderBy: reminders.scheduledFor,
      });
    } catch (error) {
      console.error("Error fetching reminders by message:", error);
      throw new Error(
        `Failed to fetch reminders: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Semantic search for reminders using embedding similarity
   */
  async searchRemindersSemantic(
    query: string,
    userId: string,
    projectId: string,
    limit: number = 5,
  ): Promise<VectorSearchResult<Reminder>[]> {
    try {
      // Generate embedding for the search query using the generic service
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      if (queryEmbedding.length === 0) {
        // Fallback to text search if embedding generation fails
        return this.searchRemindersByText(query, userId, projectId, limit).then((results) =>
          results.map((item) => ({
            item,
            similarity: 0.5,
            distance: 0.5,
          })),
        );
      }

      // Use generic vector search helper
      const vectorResults = await vectorSearch<Reminder>({
        table: reminders,
        embeddingColumn: reminders.embedding,
        selectColumns: {
          id: reminders.id,
          projectId: reminders.projectId,
          userId: reminders.userId,
          messageId: reminders.messageId,
          content: reminders.content,
          summary: reminders.summary,
          embedding: reminders.embedding,
          tags: reminders.tags,
          scheduledFor: reminders.scheduledFor,
          recurrenceType: reminders.recurrenceType,
          recurrenceInterval: reminders.recurrenceInterval,
          recurrenceEndDate: reminders.recurrenceEndDate,
          isRecurring: reminders.isRecurring,
          isCompleted: reminders.isCompleted,
          createdAt: reminders.createdAt,
        },
        where: [
          eq(reminders.userId, userId),
          eq(reminders.projectId, projectId),
          eq(reminders.isCompleted, false),
        ],
        queryEmbedding,
        limit,
      });

      return vectorResults;
    } catch (error) {
      console.error("Error in semantic reminder search:", error);
      throw new Error(
        `Failed to search reminders: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Search reminders by text content (fuzzy search)
   */
  async searchRemindersByText(
    query: string,
    userId: string,
    projectId: string,
    limit: number = 10,
  ): Promise<Reminder[]> {
    try {
      const searchTerm = `%${query.toLowerCase()}%`;

      return await db.query.reminders.findMany({
        where: and(
          eq(reminders.userId, userId),
          eq(reminders.projectId, projectId),
          eq(reminders.isCompleted, false),
          or(ilike(reminders.content, searchTerm), ilike(reminders.summary, searchTerm)),
        ),
        orderBy: reminders.scheduledFor,
        limit,
      });
    } catch (error) {
      console.error("Error searching reminders by text:", error);
      throw new Error(
        `Failed to search reminders by text: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Search reminders by tags
   */
  async searchRemindersByTags(
    tags: string[],
    userId: string,
    projectId: string,
    limit: number = 10,
  ): Promise<Reminder[]> {
    try {
      return await db.query.reminders.findMany({
        where: and(
          eq(reminders.userId, userId),
          eq(reminders.projectId, projectId),
          eq(reminders.isCompleted, false),
          sql`${reminders.tags} && ${tags}`, // Array overlap operator
        ),
        orderBy: reminders.scheduledFor,
        limit,
      });
    } catch (error) {
      console.error("Error searching reminders by tags:", error);
      throw new Error(
        `Failed to search reminders by tags: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Combined search - finds reminders by content, tags, or semantic similarity
   * This is the main search method that should be used by the AI/LLM
   */
  async findReminders(
    query: string,
    userId: string,
    projectId: string,
    options?: {
      limit?: number;
      includeCompleted?: boolean;
      searchMethods?: ("semantic" | "text" | "tags")[];
    },
  ): Promise<{
    semantic: VectorSearchResult<Reminder>[];
    text: Reminder[];
    tags: Reminder[];
    combined: Reminder[];
  }> {
    const limit = options?.limit || 5;
    const searchMethods = options?.searchMethods || ["semantic", "text", "tags"];

    try {
      const results = {
        semantic: [] as VectorSearchResult<Reminder>[],
        text: [] as Reminder[],
        tags: [] as Reminder[],
        combined: [] as Reminder[],
      };

      // Extract potential tags from query
      const queryWords = query
        .toLowerCase()
        .split(" ")
        .filter((word) => word.length > 2);

      // Parallel search execution
      const searches = [];

      if (searchMethods.includes("semantic")) {
        searches.push(
          this.searchRemindersSemantic(query, userId, projectId, limit)
            .then((res) => {
              results.semantic = res;
            })
            .catch((err) => console.error("Semantic search failed:", err)),
        );
      }

      if (searchMethods.includes("text")) {
        searches.push(
          this.searchRemindersByText(query, userId, projectId, limit)
            .then((res) => {
              results.text = res;
            })
            .catch((err) => console.error("Text search failed:", err)),
        );
      }

      if (searchMethods.includes("tags")) {
        searches.push(
          this.searchRemindersByTags(queryWords, userId, projectId, limit)
            .then((res) => {
              results.tags = res;
            })
            .catch((err) => console.error("Tag search failed:", err)),
        );
      }

      // Wait for all searches to complete
      await Promise.all(searches);

      // Combine and deduplicate results
      const allReminders = new Map<string, Reminder>();

      // Add semantic results (highest priority)
      results.semantic.forEach((result) => {
        if (result.similarity > 0.7) {
          // Only high-confidence semantic matches
          allReminders.set(result.item.id, result.item);
        }
      });

      // Add text search results
      results.text.forEach((reminder) => {
        allReminders.set(reminder.id, reminder);
      });

      // Add tag search results
      results.tags.forEach((reminder) => {
        allReminders.set(reminder.id, reminder);
      });

      results.combined = Array.from(allReminders.values())
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
        .slice(0, limit);

      console.log(`Found reminders for "${query}":`, {
        semantic: results.semantic.length,
        text: results.text.length,
        tags: results.tags.length,
        combined: results.combined.length,
      });

      return results;
    } catch (error) {
      console.error("Error in combined reminder search:", error);
      throw new Error(
        `Failed to find reminders: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * CRON JOB FUNCTION - Process all due reminders
   * This should be called by a cron job every minute
   */
  async processAllDueReminders(): Promise<{
    processed: number;
    completed: number;
    rescheduled: number;
    ended: number;
    notificationsSent: number;
    notificationsFailed: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      completed: 0,
      rescheduled: 0,
      ended: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      errors: [] as string[],
    };

    try {
      const dueReminders = await this.getDueReminders();

      console.log(`Processing ${dueReminders.length} due reminders...`);

      for (const reminder of dueReminders) {
        try {
          // First, try to send the notification
          const notificationResult = await notificationService.sendReminderNotification(reminder);

          if (notificationResult.success) {
            results.notificationsSent++;
            console.log(`✅ Notification sent for reminder: ${reminder.content}`);
          } else {
            results.notificationsFailed++;
            console.error(
              `❌ Failed to send notification for reminder ${reminder.id}:`,
              notificationResult.error,
            );
          }

          // Process the reminder (complete or reschedule)
          const result = await this.processDueReminder(reminder.id);
          results.processed++;

          switch (result.action) {
            case "completed":
              results.completed++;
              break;
            case "rescheduled":
              results.rescheduled++;
              break;
            case "ended":
              results.ended++;
              break;
          }

          console.log(`Reminder processed: ${reminder.content}`, {
            action: result.action,
            nextScheduledFor: result.nextScheduledFor,
          });
        } catch (error) {
          const errorMsg = `Failed to process reminder ${reminder.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
          results.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log("Due reminders processing complete:", results);
      return results;
    } catch (error) {
      const errorMsg = `Failed to process due reminders: ${error instanceof Error ? error.message : "Unknown error"}`;
      results.errors.push(errorMsg);
      console.error(errorMsg);
      return results;
    }
  }
}

export const reminderService = new ReminderService();
