import { RunToolCallItem, RunToolCallOutputItem } from "@openai/agents";
import { StreamUIAdapter } from "../../agent/agent-runner";
import type { Context } from "telegraf";

/**
 * Telegram implementation of StreamUIAdapter. It either sends a new message
 * for every update or edits a single status message (configurable).
 */
export class TelegramStreamUI implements StreamUIAdapter {
  constructor(private ctx: Context) { }

  async onStatus(text: string) {
    await this.sendMessage(text)
  }

  async onToolStart(item: RunToolCallItem) {
    if ('name' in item.rawItem) {
      await this.sendMessage(`🔧 Running tool *${item.rawItem.name}*…`);
    }
  }

  async onToolResult(item: RunToolCallOutputItem) {
    await this.sendMessage('✅ Tool finished.');
  }

  private async sendMessage(message: string) {
    await this.ctx.reply(message, { parse_mode: 'Markdown' });
  }
}