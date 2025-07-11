import { run, user as userMessage, assistant as assistantMessage, system as systemMessage, RunToolCallItem } from "@openai/agents";
import { mainAgent } from "./main-agent.js";
import { MessageService } from "../services/message.service.js";
import type { DatabaseContext, ProcessedMessage } from "../types/index.js";
import { Context } from "telegraf";
import { AgentRunner } from "./agent-runner.js";
import { TelegramStreamUI } from "../gateways/telegram/telegram-stream-ui.js";
import { BaseGateway } from "../gateways/base-gateway.js";
import { TelegramGateway } from "../gateways/index.js";

export class MainAgentService {
  private messageService: MessageService;

  constructor() {
    this.messageService = new MessageService();
  }

  /**
   * Generate a reply from the main agent given the newly received message and
   * the database context (project / user / channel).
   *
   * Strategy: fetch the last `limit` messages in the conversation (oldest → newest),
   * build agent input list, append the new message at the end, and run the agent.
   *
   * NOTE: Currently we only include user messages in the context. Assistant
   * messages are not yet stored in DB. When we start saving them, we can extend
   * this method to include them as `assistant` role items.
   */
  async generateReply(
    ctx: Context,
    newMessageContent: string,
    context: DatabaseContext,
    options: { limit?: number } = {}
  ): Promise<string> {
    const limit = options.limit ?? 10;

    // Fetch recent user messages for the same channel (oldest-first order)
    const history = await this.messageService.getConversationContext(
      context.userId,
      context.projectId,
      context.channelId,
      limit
    );

    // Build input for the agent – start with history, then the new message.
    const inputItems = history
      .reverse() // DB returns newest first → reverse to chronological
      .map((m) =>
        m.role === 'assistant' ? assistantMessage(m.content) : userMessage(m.content)
      );

    // Append the freshly received message.
    inputItems.push(userMessage(newMessageContent));

    const agentRunner = new AgentRunner(mainAgent, new TelegramStreamUI(ctx));
    const result = await agentRunner.run(inputItems, context);

    return result?.finalOutput || '';
  }

  /** Create a friendly acknowledgement for a processed photo */
  async generatePhotoAck(processedMessage: ProcessedMessage): Promise<string> {
    const meta = processedMessage.processingMetadata || {};
    const desc = meta.description || meta.summary || processedMessage.content || "Bir fotoğraf";

    const promptSystem =
      "Kullanıcıya aşağıdaki fotoğrafla ilgili SAMİMİ, emojili ve en fazla 2 cümlelik Türkçe bir onay mesajı yaz. " +
      "Mesajın sonunda görseli kaydettiğini belirt."
    ;

    const messages = [
      systemMessage(promptSystem),
      userMessage(`Fotoğrafın tanımı: ${desc}`),
    ];

    try {
      const result = await run(mainAgent, messages);
      const output = result.finalOutput;
      if (typeof output === "string") return output;
      return JSON.stringify(output);
    } catch (err) {
      console.error("Failed to generate photo ack via mainAgent", err);
      return `📸 ${desc} — Kaydettim!`;
    }
  }
} 