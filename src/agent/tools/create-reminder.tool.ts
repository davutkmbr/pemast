import { type RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { ReminderService } from "../../services/reminder.service.js";
import type { CreateReminderInput, GatewayContext, RecurrenceType } from "../../types/index.js";

/**
 * Tool: create_reminder
 * Creates reminders with optional recurrence support
 */

// Recurrence schema
const RecurrenceSchema = z.object({
  type: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).describe("Type of recurrence"),
  interval: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Recurrence interval (e.g., every 2 weeks)"),
  endDate: z.string().nullish().describe("When to stop recurring (ISO datetime)"),
});

const CreateReminderParams = z.object({
  content: z.string().describe("Full reminder content/message"),
  scheduledFor: z.string().describe("When to trigger the reminder (ISO datetime)"),
  summary: z.string().nullish().describe("Brief summary for better search (ALWAYS IN ENGLISH)"),
  tags: z
    .array(z.string())
    .nullish()
    .describe("Tags for categorization (ALWAYS IN ENGLISH, e.g., ['birthday', 'friend', 'work'])"),
  recurrence: RecurrenceSchema.nullish().describe("Recurrence settings (optional)"),
});

export type RecurrenceSchema = z.infer<typeof RecurrenceSchema>;
export type CreateReminderParamsSchema = z.infer<typeof CreateReminderParams>;

/**
 * Parse and validate datetime string
 */
function parseDateTime(dateTimeStr: string): Date {
  const date = new Date(dateTimeStr);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateTimeStr}`);
  }
  return date;
}

/**
 * Calculate next occurrence of a date (for recurring events)
 */
function getNextOccurrence(
  date: Date,
  recurrenceType?: RecurrenceType,
  interval: number = 1,
): Date {
  const now = new Date();
  const nextOccurrence = new Date(date);

  // If date is in the future and no recurrence, return as is
  if (date > now && !recurrenceType) {
    return nextOccurrence;
  }

  // Handle different recurrence types
  switch (recurrenceType) {
    case "daily":
      // Find next daily occurrence
      while (nextOccurrence <= now) {
        nextOccurrence.setDate(nextOccurrence.getDate() + interval);
      }
      break;

    case "weekly":
      // Find next weekly occurrence
      while (nextOccurrence <= now) {
        nextOccurrence.setDate(nextOccurrence.getDate() + 7 * interval);
      }
      break;

    case "monthly":
      // Find next monthly occurrence
      while (nextOccurrence <= now) {
        nextOccurrence.setMonth(nextOccurrence.getMonth() + interval);
      }
      break;

    case "yearly": {
      // Find next yearly occurrence
      const currentYear = now.getFullYear();
      nextOccurrence.setFullYear(currentYear);

      // If this year's occurrence has passed, move to next year(s)
      while (nextOccurrence <= now) {
        nextOccurrence.setFullYear(nextOccurrence.getFullYear() + interval);
      }
      break;
    }

    case "none":
    default:
      // For non-recurring events, if date is in the past, it's an error
      if (nextOccurrence <= now) {
        throw new Error("Non-recurring reminder cannot be scheduled for the past");
      }
      break;
  }

  return nextOccurrence;
}

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
 * Generate recurrence description
 */
function generateRecurrenceDescription(recurrence?: RecurrenceSchema | null): string {
  if (!recurrence || recurrence.type === "none") {
    return "One-time reminder";
  }

  const intervalText = recurrence.interval === 1 ? "" : `${recurrence.interval} `;
  const typeText = {
    daily: "günde",
    weekly: "haftada",
    monthly: "ayda",
    yearly: "yılda",
  }[recurrence.type];

  let description = `Her ${intervalText}${typeText} tekrar eder`;

  if (recurrence.endDate) {
    const endDate = new Date(recurrence.endDate);
    description += ` (${formatDate(endDate)} tarihine kadar)`;
  }

  return description;
}

/**
 * Process reminder creation
 */
async function createReminder(
  params: CreateReminderParamsSchema,
  context: GatewayContext,
): Promise<string> {
  const reminderService = new ReminderService();

  // Parse scheduled date
  let scheduledFor = parseDateTime(params.scheduledFor);

  // Auto-calculate next occurrence for recurring events or past dates
  if (params.recurrence?.type && params.recurrence.type !== "none") {
    // For all recurring events, calculate next occurrence
    scheduledFor = getNextOccurrence(
      scheduledFor,
      params.recurrence.type as RecurrenceType,
      params.recurrence.interval || 1,
    );
  } else if (scheduledFor <= new Date()) {
    // For non-recurring events, ensure it's not in the past
    scheduledFor = getNextOccurrence(scheduledFor, "none");
  }

  // Final check - should not be in the past after calculation
  if (scheduledFor <= new Date()) {
    throw new Error("Unable to schedule reminder for a valid future date");
  }

  // Prepare reminder input
  const reminderInput: CreateReminderInput = {
    messageId: context.messageId,
    content: params.content,
    scheduledFor,
    ...(params.summary && { summary: params.summary }),
    tags: params.tags || [],
    ...(params.recurrence && {
      recurrence: {
        type: params.recurrence.type as RecurrenceType,
        ...(params.recurrence.interval && { interval: params.recurrence.interval }),
        ...(params.recurrence.endDate && { endDate: new Date(params.recurrence.endDate) }),
      },
    }),
  };

  // Create reminder
  const reminderId = await reminderService.createReminder(reminderInput, context);

  return reminderId;
}

/**
 * Generate success response
 */
function generateSuccessResponse(params: CreateReminderParamsSchema, reminderId: string): string {
  const scheduledDate = new Date(params.scheduledFor);
  const recurrenceDesc = generateRecurrenceDescription(params.recurrence);

  return `✅ **Reminder Created Successfully**

📝 **Content:** ${params.content}
⏰ **Scheduled:** ${formatDate(scheduledDate)}
🔄 **Recurrence:** ${recurrenceDesc}
🆔 **ID:** ${reminderId}
${params.tags && params.tags.length > 0 ? `🏷️ **Tags:** ${params.tags.join(", ")}` : ""}

The reminder has been saved and will be triggered at the scheduled time.`;
}

export const createReminderTool = tool({
  name: "create_reminder",
  description: `Creates a reminder with optional recurrence support.

IMPORTANT: Always focus on FUTURE dates. For ALL recurring events:
- If given a past date, automatically calculate the next occurrence
- Daily: "Take medicine at 9 AM" → next 9 AM
- Weekly: "Team meeting every Monday" → next Monday
- Monthly: "Pay rent on the 1st" → next month's 1st
- Yearly: "Birthday on July 8th" → next July 8th
- Always use ENGLISH for summary and tags parameters
- Support intervals (e.g., "every 2 weeks", "every 3 months")

Features:
- One-time or recurring reminders (daily, weekly, monthly, yearly)
- Automatic future date calculation for ALL recurring events
- Interval support (every N days/weeks/months/years)
- Semantic search support via embeddings
- Flexible scheduling with timezone support
- Tag-based categorization (always in English)
- Automatic notification delivery

Examples:
- "Call mom tomorrow at 2 PM" → one-time future reminder
- "Take medication daily at 9 AM" → daily recurring from next 9 AM
- "Team meeting every Monday at 10 AM" → weekly recurring from next Monday
- "Pay rent every month on the 1st" → monthly recurring from next 1st
- "Birthday reminder yearly on July 8th" → yearly recurring from next July 8th
- "Dentist appointment every 6 months" → recurring every 6 months

The tool validates dates and automatically calculates future occurrences for all recurring events.`,
  parameters: CreateReminderParams,
  // strict: true,
  execute: async (data: CreateReminderParamsSchema, runContext?: RunContext<GatewayContext>) => {
    const context = runContext?.context;
    if (!context) {
      return "⚠️ Missing database context; cannot create reminder.";
    }

    try {
      console.log("Creating reminder:", data);
      const reminderId = await createReminder(data, context);
      return generateSuccessResponse(data, reminderId);
    } catch (error) {
      console.error("Error creating reminder:", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ **Failed to create reminder**

Error: ${errorMessage}

Please check the date format and try again.`;
    }
  },
});
