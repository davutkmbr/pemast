import {
  run,
  user as userMessage,
  assistant as assistantMessage,
  system as systemMessage,
} from "@openai/agents";
import { mainAgent } from "../agent/main-agent.js";
import { MessageService } from "../services/message.service.js";
import { MemoryService } from "../services/memory.service.js";
import type { DatabaseContext, GatewayContext, ProcessedMessage } from "../types/index.js";
import type { ReplyGenerator } from "./message-pipeline.js";

/**
 * Platform-agnostic reply generator
 * No UI dependencies - pure business logic
 */
export class CoreReplyGenerator implements ReplyGenerator {
  private messageService: MessageService;
  private memoryService: MemoryService;

  constructor(messageService?: MessageService, memoryService?: MemoryService) {
    this.messageService = messageService || new MessageService();
    this.memoryService = memoryService || new MemoryService();
  }

  /**
   * Generate a reply using conversation context + personal context
   * No UI streaming - just returns the final text
   */
  async generateReply(
    messageContent: string,
    context: DatabaseContext | GatewayContext,
    options: { limit?: number } = {},
  ): Promise<string> {
    const limit = options.limit ?? 10;

    // Extract database context (works for both DatabaseContext and GatewayContext)
    const dbCtx: DatabaseContext = {
      userId: context.userId,
      projectId: context.projectId,
      channelId: context.channelId,
    };

    // Fetch recent conversation history
    const history = await this.messageService.getConversationContext(
      dbCtx.userId,
      dbCtx.projectId,
      dbCtx.channelId,
      limit,
    );

    // Fetch personal context memories
    const personalMemories = await this.memoryService.getPersonalContext(
      dbCtx.userId,
      dbCtx.projectId,
      15, // Get up to 15 personal context items
    );

    // Format personal context for prompt
    const personalContext = this.memoryService.formatPersonalContextForPrompt(personalMemories);

    // Build agent input with personal context first
    const inputItems = [];

    // Add personal context as system message if available
    if (personalMemories.length > 0) {
      inputItems.push(
        systemMessage(
          `IMPORTANT: Here is what you know about this user personally. Use this information to provide more personalized responses:\n\n${personalContext}`,
        ),
      );
    }

    // Add conversation history (chronological order)
    history
      .reverse() // DB returns newest first → reverse to chronological
      .forEach((m) => {
        inputItems.push(
          m.role === "assistant" ? assistantMessage(m.content) : userMessage(m.content),
        );
      });

    // Append the new message
    inputItems.push(userMessage(messageContent));

    // Run agent without streaming - pass the full context (GatewayContext if available)
    const result = await run(mainAgent, inputItems, {
      stream: false,
      context,
    });

    return result.finalOutput || "";
  }

  /**
   * Generate photo acknowledgment with personal context
   */
  async generatePhotoAck(
    processedMessage: ProcessedMessage,
    context: DatabaseContext | GatewayContext,
  ): Promise<string> {
    // Extract database context
    const dbCtx: DatabaseContext = {
      userId: context.userId,
      projectId: context.projectId,
      channelId: context.channelId,
    };

    const meta = processedMessage.processingMetadata || {};
    const desc = meta.description || meta.summary || processedMessage.content || "Bir fotoğraf";

    // Get personal context for more personalized photo response
    const personalMemories = await this.memoryService.getPersonalContext(
      dbCtx.userId,
      dbCtx.projectId,
      10,
    );

    const personalContext =
      personalMemories.length > 0
        ? this.memoryService.formatPersonalContextForPrompt(personalMemories)
        : "";

    const promptSystem =
      "Kullanıcıya aşağıdaki fotoğrafla ilgili SAMİMİ, emojili ve en fazla 2 cümlelik Türkçe bir onay mesajı yaz. " +
      "Mesajın sonunda görseli kaydettiğini belirt." +
      (personalContext ? `\n\nKullanıcı hakkında bildiğin bilgiler:\n${personalContext}` : "");

    const messages = [systemMessage(promptSystem), userMessage(`Fotoğrafın tanımı: ${desc}`)];

    try {
      const result = await run(mainAgent, messages, { stream: false, context });
      const output = result.finalOutput;
      if (typeof output === "string") return output;
      return JSON.stringify(output);
    } catch (err) {
      console.error("Failed to generate photo ack via mainAgent", err);
      return `📸 ${desc} — Kaydettim!`;
    }
  }
}
