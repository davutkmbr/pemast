import type { Context } from "telegraf";
import { Input, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { CoreMessagePipeline } from "../../core/message-pipeline.js";
import { StreamingReplyGenerator } from "../../core/streaming-reply-generator.js";
import { MessageProcessingService } from "../../services/message-processing.service.js";
import type {
  DatabaseContext,
  GatewayContext,
  ProcessedMessage,
  UserContext,
} from "../../types/index.js";
import {
  BaseGateway,
  type FileData,
  type FileSendOptions,
  type FileType,
  type GatewayConfig,
} from "../base-gateway.js";
import type { MessageProcessor } from "../types.js";
import { TelegramExtractor } from "./telegram-extractor.js";
import { TelegramStreamingUI } from "./telegram-streaming-ui.js";

/**
 * Refactored Telegram Gateway using core pipeline
 * Clean separation of concerns, dependency injection
 */
export class TelegramGateway extends BaseGateway {
  private bot: Telegraf;
  private extractor: TelegramExtractor;
  private processors: Map<string, MessageProcessor> = new Map();
  private messagePipeline: CoreMessagePipeline;
  private status: "starting" | "running" | "stopping" | "stopped" = "stopped";

  constructor(config: GatewayConfig, messageProcessingService?: MessageProcessingService) {
    super(config);
    this.bot = new Telegraf(config.token);
    this.extractor = new TelegramExtractor();

    // Inject dependencies
    const processingService = messageProcessingService || new MessageProcessingService();

    // Create core pipeline (no UI dependency here)
    this.messagePipeline = new CoreMessagePipeline(
      processingService,
      {} as any, // Placeholder - will be replaced per request
    );

    this.setupHandlers();
  }

  getGatewayType(): string {
    return "telegram";
  }

  getStatus(): "starting" | "running" | "stopping" | "stopped" {
    return this.status;
  }

  registerProcessor(type: string, processor: MessageProcessor): void {
    this.processors.set(type, processor);
  }

  async sendMessage(ctx: Context, message: string): Promise<void> {
    const ui = new TelegramStreamingUI(ctx);
    await ui.sendMessage(message);
  }

  // === File Sending Implementation ===

  /**
   * Generic file sending method - handles any file type
   */
  async sendFile(
    ctx: Context,
    fileData: FileData,
    fileType: FileType,
    options?: FileSendOptions,
  ): Promise<void> {
    try {
      // Prepare the input file
      const inputFile = Input.fromBuffer(Buffer.from(fileData.buffer), fileData.fileName);

      // Prepare send options
      const sendOptions: any = {
        ...options,
      };

      // Add caption if provided (except for video notes which don't support captions)
      if (options?.caption && fileType !== "video_note") {
        sendOptions.caption = options.caption;
      }

      // Route to appropriate Telegram API method based on file type
      switch (fileType) {
        case "photo":
          await ctx.replyWithPhoto(inputFile, sendOptions);
          break;
        case "audio":
          await ctx.replyWithAudio(inputFile, sendOptions);
          break;
        case "voice":
          await ctx.replyWithVoice(inputFile, sendOptions);
          break;
        case "document":
          await ctx.replyWithDocument(inputFile, sendOptions);
          break;
        case "video":
          await ctx.replyWithVideo(inputFile, sendOptions);
          break;
        case "video_note":
          // Video notes use different input type, so we'll handle it specially
          await ctx.replyWithDocument(inputFile, sendOptions); // Fallback to document for now
          break;
        default:
          // Fallback to document for unknown types
          await ctx.replyWithDocument(inputFile, sendOptions);
      }
    } catch (error) {
      console.error(`Error sending ${fileType}:`, error);
      throw error;
    }
  }

  /**
   * Send a photo/image file
   */
  async sendPhoto(ctx: Context, fileData: FileData, options?: FileSendOptions): Promise<void> {
    await this.sendFile(ctx, fileData, "photo", options);
  }

  /**
   * Send an audio file
   */
  async sendAudio(ctx: Context, fileData: FileData, options?: FileSendOptions): Promise<void> {
    await this.sendFile(ctx, fileData, "audio", options);
  }

  /**
   * Send a voice message
   */
  async sendVoice(ctx: Context, fileData: FileData, options?: FileSendOptions): Promise<void> {
    await this.sendFile(ctx, fileData, "voice", options);
  }

  /**
   * Send a document/file
   */
  async sendDocument(ctx: Context, fileData: FileData, options?: FileSendOptions): Promise<void> {
    await this.sendFile(ctx, fileData, "document", options);
  }

  /**
   * Send a video file
   */
  async sendVideo(ctx: Context, fileData: FileData, options?: FileSendOptions): Promise<void> {
    await this.sendFile(ctx, fileData, "video", options);
  }

  /**
   * Send a video note (circle video)
   */
  async sendVideoNote(ctx: Context, fileData: FileData, options?: FileSendOptions): Promise<void> {
    await this.sendFile(ctx, fileData, "video_note", options);
  }

  private setupHandlers() {
    // Handle text messages
    this.bot.on(message("text"), async (ctx) => {
      await this.handleMessage(ctx, "text");
    });

    // Handle voice messages
    this.bot.on(message("voice"), async (ctx) => {
      await this.handleMessage(ctx, "voice");
    });

    // Handle documents
    this.bot.on(message("document"), async (ctx) => {
      await this.handleMessage(ctx, "document");
    });

    // Handle photos
    this.bot.on(message("photo"), async (ctx) => {
      await this.handleMessage(ctx, "photo");
    });

    // Handle audio files
    this.bot.on(message("audio"), async (ctx) => {
      await this.handleMessage(ctx, "voice");
    });

    // Handle start command
    this.bot.command("start", (ctx) => {
      ctx.reply(
        "👋 Hello! I am your personal assistant. I can help you with:\n\n" +
          "📝 Text messages - Ask me anything\n" +
          "🎤 Voice messages - I'll transcribe them\n" +
          "📄 Documents - I'll analyze and summarize\n" +
          "📸 Photos - I'll describe and extract text\n\n" +
          "Just send me any message and I'll help you!",
        { parse_mode: "Markdown" },
      );
    });
  }

  private async handleMessage(ctx: Context, messageType: string) {
    try {
      // 1. Process the message (extract or use processor)
      const processedMessage = await this.processMessage(ctx, messageType);

      // 2. Extract user context
      const userContext: UserContext = this.extractor.extractUserContext(ctx);

      // 3. Save to database using core pipeline
      const result = await this.messagePipeline.processMessage(
        processedMessage,
        userContext,
        "telegram",
      );

      if (!result.success) {
        await ctx.reply("Sorry, I encountered an error processing your message.");
        return;
      }

      // 4. Generate reply with streaming UI and gateway context
      const ui = new TelegramStreamingUI(ctx);
      const replyGenerator = new StreamingReplyGenerator(ui);

      // 5. Create GatewayContext for agent tools
      const gatewayContext: GatewayContext = {
        ...result.context,
        gateway: this,
        originalContext: ctx,
        replyGenerator,
      };

      let reply: string;
      if (processedMessage.messageType === "photo") {
        reply = await replyGenerator.generatePhotoAck(processedMessage, gatewayContext);
      } else {
        reply = await replyGenerator.generateReply(processedMessage.content, gatewayContext);
      }

      // 6. Send final reply
      await ui.sendMessage(reply);

      // 7. Save assistant message
      await this.saveAssistantMessage(ctx, reply, result.context);
    } catch (error) {
      console.error("Error handling message:", error);
      await ctx.reply("Sorry, I encountered an error processing your message.");
    }
  }

  private async processMessage(ctx: Context, messageType: string): Promise<ProcessedMessage> {
    const processor = this.processors.get(messageType);

    if (processor) {
      console.log(`✅ Using processor for ${messageType}`);
      return processor.processMessage(ctx);
    } else {
      console.log(`⚠️ No processor found for ${messageType}, using extractor`);
      return this.extractor.extractMessage(ctx, messageType);
    }
  }

  private async saveAssistantMessage(ctx: Context, content: string, context: DatabaseContext) {
    try {
      // Get Telegram message ID from the last sent message
      // This is a bit tricky - we'd need to track the sent message
      // For now, we'll use a timestamp-based ID
      const gatewayMessageId = `assistant_${Date.now()}`;

      const processedMessage: ProcessedMessage = {
        content,
        messageType: "text",
        gatewayType: "telegram",
        gatewayMessageId,
        timestamp: new Date(),
      };

      await this.messagePipeline.processMessage(
        processedMessage,
        this.extractor.extractUserContext(ctx),
        "telegram",
      );

      console.log("💾 Assistant message saved");
    } catch (err) {
      console.error("Failed to save assistant message:", err);
    }
  }

  start() {
    if (this.status !== "stopped") {
      console.warn("Gateway is already starting or running");
      return;
    }

    this.status = "starting";

    this.bot
      .launch()
      .then(() => {
        this.status = "running";
        console.log("🚀 Telegram gateway V2 started successfully");
      })
      .catch((error) => {
        this.status = "stopped";
        console.error("Failed to start Telegram gateway V2:", error);
      });
  }

  stop() {
    if (this.status === "stopped" || this.status === "stopping") {
      return;
    }

    this.status = "stopping";

    this.bot.stop("SIGTERM");
    this.status = "stopped";
    console.log("🛑 Telegram gateway V2 stopped");
  }
}
