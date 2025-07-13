import { type RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { ReminderService } from "../../services/reminder.service.js";
import type { GatewayContext, Reminder } from "../../types/index.js";

/**
 * Tool: list_upcoming_reminders
 * Lists upcoming reminders for the user
 */

const ListUpcomingRemindersParams = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of reminders to return"),
  includeToday: z.boolean().default(true).describe("Include reminders due today"),
  daysAhead: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe("Number of days ahead to look for reminders"),
});

export type ListUpcomingRemindersParams = z.infer<typeof ListUpcomingRemindersParams>;

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
 * Get time until reminder
 */
function getTimeUntil(date: Date): string {
  const now = new Date();
  const timeDiff = date.getTime() - now.getTime();

  if (timeDiff <= 0) {
    return "Due now";
  }

  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days} gün`;
  } else if (hours > 0) {
    return `${hours} saat`;
  } else {
    return `${minutes} dakika`;
  }
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
 * Format a single reminder for display
 */
function formatReminder(reminder: Reminder, index: number): string {
  const scheduledDate = new Date(reminder.scheduledFor);
  const timeUntil = getTimeUntil(scheduledDate);
  const formattedDate = formatDate(scheduledDate);
  const recurrenceInfo = formatRecurrence(reminder);
  const tags = reminder.tags && reminder.tags.length > 0 ? ` [${reminder.tags.join(", ")}]` : "";

  const statusEmoji = timeUntil === "Due now" ? "🔔" : "⏰";

  return `${index + 1}. ${statusEmoji} **${reminder.content}**
   📅 ${formattedDate} (${timeUntil})
   🔄 ${recurrenceInfo}${tags}
   🆔 ID: ${reminder.id}`;
}

/**
 * Group reminders by time categories
 */
function groupRemindersByTime(reminders: Reminder[]): {
  overdue: Reminder[];
  today: Reminder[];
  tomorrow: Reminder[];
  thisWeek: Reminder[];
  later: Reminder[];
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const groups = {
    overdue: [] as Reminder[],
    today: [] as Reminder[],
    tomorrow: [] as Reminder[],
    thisWeek: [] as Reminder[],
    later: [] as Reminder[],
  };

  reminders.forEach((reminder) => {
    const reminderDate = new Date(reminder.scheduledFor);
    const reminderDay = new Date(
      reminderDate.getFullYear(),
      reminderDate.getMonth(),
      reminderDate.getDate(),
    );

    if (reminderDate < now) {
      groups.overdue.push(reminder);
    } else if (reminderDay.getTime() === today.getTime()) {
      groups.today.push(reminder);
    } else if (reminderDay.getTime() === tomorrow.getTime()) {
      groups.tomorrow.push(reminder);
    } else if (reminderDate < nextWeek) {
      groups.thisWeek.push(reminder);
    } else {
      groups.later.push(reminder);
    }
  });

  return groups;
}

/**
 * List upcoming reminders
 */
async function listUpcomingReminders(
  params: ListUpcomingRemindersParams,
  context: GatewayContext,
): Promise<{
  reminders: Reminder[];
  totalCount: number;
}> {
  const reminderService = new ReminderService();

  // Get upcoming reminders
  const upcomingReminders = await reminderService.getUpcomingReminders(
    context.userId,
    context.projectId,
    params.limit,
  );

  // Filter based on parameters
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() + params.daysAhead);

  const filteredReminders = upcomingReminders.filter((reminder) => {
    const reminderDate = new Date(reminder.scheduledFor);

    // Check if within date range
    if (reminderDate > cutoffDate) {
      return false;
    }

    // Check if today should be included
    if (!params.includeToday) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const reminderDay = new Date(
        reminderDate.getFullYear(),
        reminderDate.getMonth(),
        reminderDate.getDate(),
      );
      if (reminderDay.getTime() === today.getTime()) {
        return false;
      }
    }

    return true;
  });

  return {
    reminders: filteredReminders,
    totalCount: filteredReminders.length,
  };
}

/**
 * Generate response message
 */
function generateResponse(
  reminders: Reminder[],
  totalCount: number,
  params: ListUpcomingRemindersParams,
): string {
  if (totalCount === 0) {
    return `📅 **No upcoming reminders**

You have no reminders scheduled for the next ${params.daysAhead} days.

✨ **Want to create a new reminder?** Just tell me what you'd like to be reminded about and when!`;
  }

  const groups = groupRemindersByTime(reminders);
  let response = `📅 **Upcoming Reminders (${totalCount})**\n\n`;

  // Add overdue reminders
  if (groups.overdue.length > 0) {
    response += `🚨 **Overdue (${groups.overdue.length})**\n`;
    groups.overdue.forEach((reminder, index) => {
      response += formatReminder(reminder, index) + "\n\n";
    });
  }

  // Add today's reminders
  if (groups.today.length > 0) {
    response += `📋 **Today (${groups.today.length})**\n`;
    groups.today.forEach((reminder, index) => {
      response += formatReminder(reminder, index) + "\n\n";
    });
  }

  // Add tomorrow's reminders
  if (groups.tomorrow.length > 0) {
    response += `🌅 **Tomorrow (${groups.tomorrow.length})**\n`;
    groups.tomorrow.forEach((reminder, index) => {
      response += formatReminder(reminder, index) + "\n\n";
    });
  }

  // Add this week's reminders
  if (groups.thisWeek.length > 0) {
    response += `📆 **This Week (${groups.thisWeek.length})**\n`;
    groups.thisWeek.forEach((reminder, index) => {
      response += formatReminder(reminder, index) + "\n\n";
    });
  }

  // Add later reminders
  if (groups.later.length > 0) {
    response += `🔮 **Later (${groups.later.length})**\n`;
    groups.later.forEach((reminder, index) => {
      response += formatReminder(reminder, index) + "\n\n";
    });
  }

  response += `💡 **Tip**: Use the reminder ID to cancel or modify any reminder.`;

  return response;
}

export const listUpcomingRemindersTool = tool({
  name: "list_upcoming_reminders",
  description: `Lists upcoming reminders organized by time categories.

Features:
- **Time grouping**: Overdue, Today, Tomorrow, This Week, Later
- **Flexible filtering**: Customize days ahead and include/exclude today
- **Detailed info**: Shows time until due, recurrence, tags, and IDs
- **Status indicators**: Clear icons for overdue vs scheduled
- **Actionable IDs**: Reminder IDs for further actions

Use cases:
- "Show my upcoming reminders"
- "What do I have today?"
- "List reminders for next week"
- "Show overdue reminders"

The tool organizes reminders by urgency and provides clear time indicators.`,
  parameters: ListUpcomingRemindersParams,
  strict: true,
  execute: async (data: ListUpcomingRemindersParams, runContext?: RunContext<GatewayContext>) => {
    const context = runContext?.context;
    if (!context) {
      return "⚠️ Missing database context; cannot list reminders.";
    }

    try {
      const { reminders, totalCount } = await listUpcomingReminders(data, context);
      return generateResponse(reminders, totalCount, data);
    } catch (error) {
      console.error("Error listing upcoming reminders:", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ **Failed to list reminders**

Error: ${errorMessage}

Please try again.`;
    }
  },
});
