import type { Context } from "telegraf";
import type { StreamingUI } from "../../core/message-pipeline.js";

/**
 * Telegram implementation of StreamingUI interface
 * Handles all platform-specific UI interactions
 */
export class TelegramStreamingUI implements StreamingUI {
  constructor(private ctx: Context) {}

  async sendMessage(content: string): Promise<void> {
    try {
      // Split long messages if needed
      const maxLength = 4096; // Telegram's message limit
      if (content.length <= maxLength) {
        await this.sendSingleMessage(content);
      } else {
        // Split into chunks
        const chunks = this.splitMessage(content, maxLength);
        for (const chunk of chunks) {
          await this.sendSingleMessage(chunk);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Send a single message with Markdown fallback to plain text
   */
  private async sendSingleMessage(content: string): Promise<void> {
    try {
      // Try with Markdown first
      await this.ctx.reply(content, { parse_mode: "Markdown" });
    } catch (error: any) {
      // If Markdown parsing fails, try with plain text
      if (error?.response?.description?.includes("can't parse entities")) {
        console.warn("Markdown parsing failed, falling back to plain text");
        try {
          await this.ctx.reply(content); // No parse_mode = plain text
        } catch (plainTextError) {
          console.error("Failed to send even as plain text:", plainTextError);
          throw plainTextError;
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  }

  async sendTyping(): Promise<void> {
    try {
      await this.ctx.sendChatAction("typing");
    } catch (error) {
      console.error("Error sending typing action:", error);
    }
  }

  async onToolStart(toolName: string): Promise<void> {
    console.log("🔧 Running tool *", toolName, "*…");

    if (toolName !== "analyze_conversation") {
      await this.sendMessage(`🔧 Running tool *${toolName}*…`);
    }

    this.sendTyping();
  }

  async onToolResult(): Promise<void> {
    // await this.sendMessage("✅ Tool finished.");
  }

  async onStatus(status: string): Promise<void> {
    await this.sendMessage(status);
  }

  private splitMessage(message: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    const lines = message.split("\n");

    for (const line of lines) {
      if ((currentChunk + line + "\n").length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }

        // If a single line is too long, split it
        if (line.length > maxLength) {
          const lineChunks = line.match(new RegExp(`.{1,${maxLength - 10}}`, "g")) || [];
          chunks.push(...lineChunks);
        } else {
          currentChunk = line + "\n";
        }
      } else {
        currentChunk += line + "\n";
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
