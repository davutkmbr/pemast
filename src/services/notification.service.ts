import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { channels, projects, users } from "../db/schema.js";
import type { MessageSender } from "../gateways/message-sender.js";
import { TelegramMessageSender } from "../gateways/telegram/telegram-message-sender.js";
import type { Reminder } from "../types/index.js";

export interface NotificationResult {
  success: boolean;
  error?: string;
  deliveredAt?: Date;
  messageId?: string;
}

/**
 * Service for delivering reminder notifications through various gateway message senders
 */
export class NotificationService {
  private messageSenders: Map<string, MessageSender> = new Map();

  constructor() {
    // Initialize message senders for available gateways
    this.initializeMessageSenders();
  }

  /**
   * Initialize message senders from environment variables
   */
  private initializeMessageSenders(): void {
    // Telegram
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (telegramToken) {
      this.messageSenders.set("telegram", new TelegramMessageSender(telegramToken));
      console.log("✅ Telegram message sender initialized");
    }

    // TODO: Add other gateway message senders (Slack, Discord, etc.)
    // const slackToken = process.env.SLACK_BOT_TOKEN;
    // if (slackToken) {
    //   this.messageSenders.set("slack", new SlackMessageSender(slackToken));
    // }

    if (this.messageSenders.size === 0) {
      console.warn("⚠️ No message senders initialized. Check environment variables.");
    }
  }

  /**
   * Send a reminder notification through the appropriate gateway
   */
  async sendReminderNotification(reminder: Reminder): Promise<NotificationResult> {
    if (!reminder.userId || !reminder.projectId) {
      throw new Error("Reminder user ID or project ID is null");
    }

    try {
      // Get gateway type and chat ID for the user
      const userInfo = await this.getUserInfo(reminder.userId, reminder.projectId);

      if (!userInfo) {
        throw new Error(`User info not found for user ${reminder.userId}`);
      }

      const { gatewayType, chatId } = userInfo;

      // Ensure gatewayType is not null (TypeScript safety)
      if (!gatewayType) {
        throw new Error("Gateway type is null");
      }

      // Get appropriate message sender
      const messageSender = this.messageSenders.get(gatewayType);
      if (!messageSender) {
        throw new Error(`No message sender available for gateway type: ${gatewayType}`);
      }

      // Format reminder message
      const message = this.formatReminderMessage(reminder);

      // Send message
      const result = await messageSender.sendMessage(chatId, message, {
        parseMode: "Markdown",
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send message");
      }

      return {
        success: true,
        deliveredAt: new Date(),
        ...(result.messageId && { messageId: result.messageId }),
      };
    } catch (error) {
      console.error("Failed to send reminder notification:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get user info including gateway type and chat ID
   */
  private async getUserInfo(
    userId: string,
    projectId: string,
  ): Promise<{
    gatewayType: string;
    chatId: string;
  } | null> {
    try {
      // Get user's external ID first
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user?.externalId) {
        console.error(`User ${userId} has no external ID`);
        return null;
      }

      // Get channel for this project to determine gateway type
      // Find the channel where this user is active
      const channel = await db.query.channels.findFirst({
        where: eq(channels.projectId, projectId),
        // For now, we'll get the first channel of the project
        // TODO: Properly match user to their specific channel
      });

      if (!channel?.gatewayType) {
        console.error(`No channel found for project ${projectId}`);
        return null;
      }

      return {
        gatewayType: channel.gatewayType,
        chatId: channel.externalChatId,
      };
    } catch (error) {
      console.error("Error getting user info:", error);
      return null;
    }
  }

  /**
   * Format reminder message for display
   */
  private formatReminderMessage(reminder: Reminder): string {
    const now = new Date();
    const scheduledDate = new Date(reminder.scheduledFor);

    // Calculate delay
    const delayMinutes = Math.floor((now.getTime() - scheduledDate.getTime()) / (1000 * 60));
    const delayText = delayMinutes > 0 ? ` *(${delayMinutes} dk gecikme)*` : "";

    let message = `🔔 **Hatırlatma**${delayText}\n\n`;
    message += `📝 ${reminder.content}\n\n`;

    if (reminder.isRecurring) {
      const recurrenceText = this.getRecurrenceText(
        reminder.recurrenceType,
        reminder.recurrenceInterval,
      );
      message += `🔄 *${recurrenceText}*\n\n`;
    }

    if (reminder.tags && reminder.tags.length > 0) {
      message += `🏷️ ${reminder.tags.join(", ")}\n\n`;
    }

    message += `⏰ *Planlanan: ${scheduledDate.toLocaleString("tr-TR")}*`;

    return message;
  }

  /**
   * Get recurrence description in Turkish
   */
  private getRecurrenceText(recurrenceType: string | null, interval: number | null): string {
    if (!recurrenceType || recurrenceType === "none") {
      return "Tekrarsız";
    }

    const intervalText = interval === 1 ? "" : `${interval} `;
    const typeText =
      {
        daily: "günde",
        weekly: "haftada",
        monthly: "ayda",
        yearly: "yılda",
      }[recurrenceType] || "bilinmeyen";

    return `Her ${intervalText}${typeText} tekrar eder`;
  }

  /**
   * Batch send multiple reminder notifications
   */
  async sendMultipleNotifications(reminders: Reminder[]): Promise<{
    successful: number;
    failed: number;
    results: Array<{ reminder: Reminder; result: NotificationResult }>;
  }> {
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const reminder of reminders) {
      const result = await this.sendReminderNotification(reminder);
      results.push({ reminder, result });

      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      successful,
      failed,
      results,
    };
  }

  /**
   * Get available gateway types
   */
  getAvailableGateways(): string[] {
    return Array.from(this.messageSenders.keys());
  }
}
