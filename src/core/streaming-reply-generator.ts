import {
  assistant as assistantMessage,
  type RunStreamEvent,
  run,
  system as systemMessage,
  user as userMessage,
} from "@openai/agents";
import { createMainAgent } from "../agent/main-agent.js";
import { MemoryService } from "../services/memory.service.js";
import { MessageService } from "../services/message.service.js";
import type { DatabaseContext, GatewayContext, ProcessedMessage } from "../types/index.js";
import type { ReplyGenerator, StreamingUI } from "./message-pipeline.js";

/**
 * Streaming reply generator with UI feedback
 * Uses platform-agnostic StreamingUI interface
 */
export class StreamingReplyGenerator implements ReplyGenerator {
  private messageService: MessageService;
  private memoryService: MemoryService;

  constructor(
    private ui: StreamingUI,
    messageService?: MessageService,
    memoryService?: MemoryService,
  ) {
    this.messageService = messageService || new MessageService();
    this.memoryService = memoryService || new MemoryService();
  }

  /**
   * Generate reply with streaming UI feedback + personal context
   */
  async generateReply(
    messageContent: string,
    context: DatabaseContext | GatewayContext,
    options: { limit?: number } = {},
  ): Promise<string> {
    const limit = options.limit ?? 10;

    await this.ui.sendTyping();

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

    // TODO: Comment for now.
    // Fetch personal context memories
    /*const personalMemories = await this.memoryService.getPersonalContext(
      dbCtx.userId,
      dbCtx.projectId,
      15, // Get up to 15 personal context items
    );*/

    // Format personal context for injection into agent instructions
    const personalContext =
      /*personalMemories.length > 0
        ? this.memoryService.formatPersonalContextForPrompt(personalMemories)
        : undefined;*/
      undefined;

    // Create main agent with personal context integrated into instructions
    const agent = await createMainAgent(personalContext);

    // Build agent input
    const inputItems = [];

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

    // Run agent with streaming - pass the full context (GatewayContext if available)
    let stream = await run(agent, inputItems, {
      stream: true,
      context: { ...context, replyGenerator: this },
    });

    await this.handleStream(stream);
    await stream.completed;

    // Handle interruptions (HITL)
    while (stream.interruptions?.length) {
      const intr = stream.interruptions[0];
      if (!intr) break;

      await this.ui.onStatus("⚠️ Tool call requires approval.");

      // For now, auto-approve (later can be configurable)
      const state = stream.state;
      state.approve(intr as any);
      stream = await run(agent, state, {
        stream: true,
        context: {
          ...context,
          replyGenerator: this,
        },
      });
      await this.handleStream(stream);
      await stream.completed;
    }

    return stream.finalOutput || "";
  }

  /**
   * Generate photo acknowledgment with personal context (no streaming needed)
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

    // TODO: Comment for now.
    // Get personal context for more personalized photo response
    /*const personalMemories = await this.memoryService.getPersonalContext(
      dbCtx.userId,
      dbCtx.projectId,
      10,
    );*/

    const personalContext = undefined;
    //personalMemories.length > 0
    //  ? this.memoryService.formatPersonalContextForPrompt(personalMemories)
    //  : "";

    const promptSystem =
      "Kullanıcıya aşağıdaki fotoğrafla ilgili SAMİMİ, emojili ve en fazla 2 cümlelik Türkçe bir onay mesajı yaz. " +
      "Mesajın sonunda görseli kaydettiğini belirt." +
      (personalContext ? `\n\nKullanıcı hakkında bildiğin bilgiler:\n${personalContext}` : "");

    const messages = [systemMessage(promptSystem), userMessage(`Fotoğrafın tanımı: ${desc}`)];

    try {
      const result = await run(await createMainAgent(), messages, { stream: false, context });
      const output = result.finalOutput;
      if (typeof output === "string") return output;
      return JSON.stringify(output);
    } catch (err) {
      console.error("Failed to generate photo ack via mainAgent", err);
      return `📸 ${desc} — Kaydettim!`;
    }
  }

  /**
   * Handle streaming events and relay to UI
   */
  private async handleStream(stream: AsyncIterable<RunStreamEvent>) {
    for await (const event of stream) {
      if (event.type !== "run_item_stream_event") {
        continue;
      }

      switch (event.item.type) {
        case "tool_call_item":
          if ("name" in event.item.rawItem) {
            await this.ui.onToolStart(event.item.rawItem.name);
          }
          break;
        case "tool_call_output_item":
          await this.ui.onToolResult();
          break;
      }
    }
  }
}
