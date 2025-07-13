import { run, user as userMessage } from "@openai/agents";
import { eq } from "drizzle-orm";
import { createMainAgent } from "../agent/main-agent.js";
import { db } from "../db/client.js";
import { channels, users } from "../db/schema.js";
import type { MessageSender } from "../gateways/message-sender.js";
import { TelegramMessageSender } from "../gateways/telegram/telegram-message-sender.js";
import type { DatabaseContext, Reminder } from "../types/index.js";

export interface NotificationResult {
  success: boolean;
  error?: string;
  deliveredAt?: Date;
  messageId?: string;
}

/**
 * Service for delivering reminder notifications through various gateway message senders
 * Uses the main agent to create intelligent, contextual reminder messages
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
   * Uses the main agent to create intelligent, contextual reminder messages
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

      // Create database context for the agent (using a placeholder channelId)
      const context: DatabaseContext = {
        projectId: reminder.projectId,
        userId: reminder.userId,
        channelId: userInfo.channelId || "", // Use channel from user info
      };

      // Generate intelligent reminder message using the main agent
      const intelligentMessage = await this.generateIntelligentReminderMessage(reminder, context);

      // Send the agent-generated message
      const result = await messageSender.sendMessage(chatId, intelligentMessage, {
        // parseMode: "Markdown",
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
   * Generate intelligent reminder message using the main agent
   * Agent will analyze the reminder content and create contextual, helpful messages
   */
  private async generateIntelligentReminderMessage(
    reminder: Reminder,
    context: DatabaseContext,
  ): Promise<string> {
    try {
      console.log("🤖 Generating intelligent reminder message for:", reminder.content);

      // Create the main agent with full context
      const agent = await createMainAgent(context);

      // Calculate delay information
      const now = new Date();
      const scheduledDate = new Date(reminder.scheduledFor);
      const delayMinutes = Math.floor((now.getTime() - scheduledDate.getTime()) / (1000 * 60));
      const delayText = delayMinutes > 0 ? ` (delay: ${delayMinutes} minutes)` : "";

      // Create a comprehensive prompt for the agent
      const reminderPrompt = this.buildReminderPrompt(reminder, delayText);

      // Run the agent with the reminder task
      const response = await run(agent, [userMessage(reminderPrompt)], {
        stream: false,
        context,
      });

      // Extract the final message from the agent's response
      const finalMessage = response.finalOutput || "";

      if (!finalMessage.trim()) {
        // Fallback to basic reminder if agent fails
        console.warn("⚠️ Agent returned empty message, using fallback");
        return this.formatBasicReminderMessage(reminder);
      }

      console.log("✅ Agent generated intelligent reminder message");
      return finalMessage;
    } catch (error) {
      console.error("❌ Error generating intelligent reminder message:", error);
      // Fallback to basic reminder message if agent fails
      return this.formatBasicReminderMessage(reminder);
    }
  }

  /**
   * Build a comprehensive prompt for the agent to handle the reminder
   */
  private buildReminderPrompt(reminder: Reminder, delayText: string): string {
    const scheduledDate = new Date(reminder.scheduledFor);
    const recurrenceInfo = reminder.isRecurring
      ? this.getRecurrenceText(reminder.recurrenceType, reminder.recurrenceInterval)
      : "Tekrarsız";

    return `
REMINDER TASK${delayText}

A scheduled reminder is due and you need to create an intelligent, helpful message for the user.

**REMINDER DETAILS:**
- Content: ${reminder.content}
- Scheduled: ${scheduledDate.toLocaleString("tr-TR")}
- Recurrence: ${recurrenceInfo}
${reminder.summary ? `- Summary: ${reminder.summary}` : ""}
${reminder.tags && reminder.tags.length > 0 ? `- Tags: ${reminder.tags.join(", ")}` : ""}

**YOUR APPROACH:**

1. **ANALYZE** the reminder content to understand what the user needs to do
2. **SEARCH MEMORY** (always do this) to find related information from user's history
3. **ENHANCE** the reminder with helpful context and suggestions based on found memories
4. **WEB SEARCH** only if:
   - Reminder explicitly mentions current/time-sensitive info (weather, traffic, news, prices, etc.)
   - User specifically asked for updated information in the original reminder
   - You find outdated information in memory that needs verification

**OUTPUT REQUIREMENTS:**
- Start with 🔔 followed by CLEAR ACKNOWLEDGMENT of what they asked to be reminded about
- Example: "🔔 You asked me to remind you to [specific task]!" or "🔔 [Time period] ago you set a reminder for [specific task]!"
- Write in Turkish (warm, personal tone)
- Provide context about the original request before giving suggestions
- Include specific, actionable suggestions based on found memories only if they add value
- Keep it focused on the actual reminder, not generic advice
- Be concise but helpful

**MESSAGE STRUCTURE:**
1. 🔔 + Clear acknowledgment of the original reminder request
2. Brief, relevant context or helpful suggestions (only if memory search reveals useful info)
3. Keep it simple for basic reminders, enhance only when memory provides valuable context

**EXAMPLES OF WHEN TO USE WEB SEARCH:**
✅ "Check weather for outdoor meeting"
✅ "Get current Bitcoin price" 
✅ "Traffic conditions for airport trip"
❌ Basic daily tasks, personal reminders, routine activities

Focus on acknowledging the specific reminder first, then being helpful with relevant context from memory.
`;
  }

  /**
   * Fallback: Basic reminder message formatting (used when agent fails)
   */
  private formatBasicReminderMessage(reminder: Reminder): string {
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
   * Get user info including gateway type and chat ID
   */
  private async getUserInfo(
    userId: string,
    projectId: string,
  ): Promise<{
    gatewayType: string;
    chatId: string;
    channelId: string;
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
        channelId: channel.id,
      };
    } catch (error) {
      console.error("Error getting user info:", error);
      return null;
    }
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

export const notificationService = new NotificationService();
