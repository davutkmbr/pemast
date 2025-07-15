import type { RecurrenceType, Reminder } from "../../types/index.js";
import type { RecurrenceSchema } from "../tools/create-reminder.tool.js";

/**
 * Date Utilities
 * Consolidated date operations for tools to reduce code duplication
 */

/**
 * Format date for display using Turkish locale
 */
export function formatDate(date: Date): string {
  return date.toLocaleString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Parse and validate datetime string
 */
export function parseDateTime(dateTimeStr: string): Date {
  const date = new Date(dateTimeStr);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateTimeStr}`);
  }
  return date;
}

/**
 * Calculate next occurrence of a date (for recurring events)
 */
export function getNextOccurrence(
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
 * Get time until a future date
 */
export function getTimeUntil(date: Date): string {
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
 * Format recurrence info for a reminder
 */
export function formatRecurrence(reminder: Reminder): string {
  if (!reminder.isRecurring || reminder.recurrenceType === "none" || !reminder.recurrenceType) {
    return "One-time";
  }

  const interval = reminder.recurrenceInterval || 1;
  const intervalText = interval === 1 ? "" : `${interval} `;

  const typeTextMap: Record<RecurrenceType, string> = {
    daily: "günde",
    weekly: "haftada",
    monthly: "ayda",
    yearly: "yılda",
    none: "",
  };

  const typeText = typeTextMap[reminder.recurrenceType] || "";

  return `Her ${intervalText}${typeText}`;
}

/**
 * Generate recurrence description for create operations
 */
export function generateRecurrenceDescription(recurrence?: RecurrenceSchema): string {
  if (!recurrence || recurrence.type === "none") {
    return "One-time reminder";
  }

  const intervalText =
    recurrence.interval === 1 || !recurrence.interval ? "" : `${recurrence.interval} `;

  const typeTextMap: Record<RecurrenceType, string> = {
    daily: "günde",
    weekly: "haftada",
    monthly: "ayda",
    yearly: "yılda",
    none: "",
  };

  const typeText = typeTextMap[recurrence.type];

  let description = `Her ${intervalText}${typeText} tekrar eder`;

  if (recurrence.endDate) {
    const endDate = new Date(recurrence.endDate);
    description += ` (${formatDate(endDate)} tarihine kadar)`;
  }

  return description;
}

/**
 * Group reminders by time categories
 */
export function groupRemindersByTime(reminders: Reminder[]): {
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
 * Get status emoji and text for a reminder
 */
export function getStatusInfo(reminder: Reminder): { emoji: string; text: string } {
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
