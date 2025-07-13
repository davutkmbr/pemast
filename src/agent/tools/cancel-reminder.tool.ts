import { type RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { reminderService, ReminderService } from "../../services/reminder.service.js";
import type { GatewayContext } from "../../types/index.js";

/**
 * Tool: cancel_reminder
 * Cancels a reminder by marking it as completed
 */

const CancelReminderParams = z.object({
  reminderId: z.string().describe("The unique ID of the reminder to cancel"),
  reason: z.string().nullish().describe("Optional reason for canceling the reminder"),
});

export type CancelReminderParams = z.infer<typeof CancelReminderParams>;

/**
 * Cancel a reminder using the service
 */
async function cancelReminder(
  params: CancelReminderParams,
  context: GatewayContext,
): Promise<{ success: boolean; message: string }> {
  try {
    // First check if reminder exists and belongs to user
    const searchResults = await reminderService.findReminders(
      params.reminderId,
      context.userId,
      context.projectId,
      { limit: 1 },
    );

    const reminder = searchResults.combined.find((r) => r.id === params.reminderId);

    if (!reminder) {
      return {
        success: false,
        message: `❌ **Reminder not found**

No reminder found with ID: ${params.reminderId}

The reminder may have been already canceled or doesn't belong to you.`,
      };
    }

    if (reminder.isCompleted) {
      return {
        success: false,
        message: `⚠️ **Already canceled**

This reminder was already completed/canceled on ${reminder.completedAt ? new Date(reminder.completedAt).toLocaleString("tr-TR") : "unknown date"}.`,
      };
    }

    // Cancel the reminder
    await reminderService.cancelReminder(params.reminderId);

    const reasonText = params.reason ? `\n📝 **Reason:** ${params.reason}` : "";

    return {
      success: true,
      message: `✅ **Reminder canceled successfully**

📋 **Canceled reminder:** ${reminder.content}
⏰ **Was scheduled for:** ${new Date(reminder.scheduledFor).toLocaleString("tr-TR")}
🔄 **Recurrence:** ${reminder.isRecurring ? "Yes" : "No"}${reasonText}

The reminder has been marked as completed and will not trigger.`,
    };
  } catch (error) {
    console.error("Error canceling reminder:", error);
    return {
      success: false,
      message: `❌ **Failed to cancel reminder**

Error: ${error instanceof Error ? error.message : "Unknown error"}

Please check the reminder ID and try again.`,
    };
  }
}

export const cancelReminderTool = tool({
  name: "cancel_reminder",
  description: `Cancels a reminder by marking it as completed.

Features:
- Cancels specific reminder by ID
- Prevents duplicate cancellations
- Provides detailed confirmation
- Includes optional reason tracking
- Validates reminder ownership

Use cases:
- "Cancel reminder abc123"
- "Remove the medication reminder"
- "Cancel meeting reminder - meeting moved"

The tool verifies the reminder exists and belongs to the user before canceling.`,
  parameters: CancelReminderParams,
  strict: true,
  execute: async (data: CancelReminderParams, runContext?: RunContext<GatewayContext>) => {
    const context = runContext?.context;
    if (!context) {
      return "⚠️ Missing database context; cannot cancel reminder.";
    }

    const result = await cancelReminder(data, context);
    return result.message;
  },
});
