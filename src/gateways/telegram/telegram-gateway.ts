import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { BaseGateway, type GatewayConfig } from '../base-gateway.js';
import { TelegramExtractor } from './telegram-extractor.js';
import { TelegramStreamingUI } from './telegram-streaming-ui.js';
import { StreamingReplyGenerator } from '../../core/streaming-reply-generator.js';
import { MessageProcessingService } from '../../services/message-processing.service.js';
import { CoreMessagePipeline } from '../../core/message-pipeline.js';
import type { MessageProcessor } from '../types.js';
import type { ProcessedMessage, DatabaseContext, UserContext } from '../../types/index.js';

/**
 * Refactored Telegram Gateway using core pipeline
 * Clean separation of concerns, dependency injection
 */
export class TelegramGatewayV2 extends BaseGateway {
  private bot: Telegraf;
  private extractor: TelegramExtractor;
  private processors: Map<string, MessageProcessor> = new Map();
  private messagePipeline: CoreMessagePipeline;
  private status: 'starting' | 'running' | 'stopping' | 'stopped' = 'stopped';

  constructor(
    config: GatewayConfig,
    messageProcessingService?: MessageProcessingService
  ) {
    super(config);
    this.bot = new Telegraf(config.token);
    this.extractor = new TelegramExtractor();
    
    // Inject dependencies
    const processingService = messageProcessingService || new MessageProcessingService();
    
    // Create core pipeline (no UI dependency here)
    this.messagePipeline = new CoreMessagePipeline(
      processingService,
      // We'll create the reply generator per-request with UI
      {} as any // Placeholder - will be replaced per request
    );

    this.setupHandlers();
  }

  getGatewayType(): 'telegram' {
    return 'telegram';
  }

  getStatus(): 'starting' | 'running' | 'stopping' | 'stopped' {
    return this.status;
  }

  registerProcessor(type: string, processor: MessageProcessor): void {
    this.processors.set(type, processor);
  }

  async sendMessage(ctx: Context, message: string): Promise<void> {
    const ui = new TelegramStreamingUI(ctx);
    await ui.sendMessage(message);
  }

  private setupHandlers() {
    // Handle text messages
    this.bot.on(message('text'), async (ctx) => {
      await this.handleMessage(ctx, 'text');
    });

    // Handle voice messages
    this.bot.on(message('voice'), async (ctx) => {
      await this.handleMessage(ctx, 'voice');
    });

    // Handle documents
    this.bot.on(message('document'), async (ctx) => {
      await this.handleMessage(ctx, 'document');
    });

    // Handle photos
    this.bot.on(message('photo'), async (ctx) => {
      await this.handleMessage(ctx, 'photo');
    });

    // Handle audio files
    this.bot.on(message('audio'), async (ctx) => {
      await this.handleMessage(ctx, 'voice');
    });

    // Handle start command
    this.bot.command('start', (ctx) => {
      ctx.reply('👋 Hello! I am your personal assistant. I can help you with:\n\n' +
        '📝 Text messages - Ask me anything\n' +
        '🎤 Voice messages - I\'ll transcribe them\n' +
        '📄 Documents - I\'ll analyze and summarize\n' +
        '📸 Photos - I\'ll describe and extract text\n\n' +
        'Just send me any message and I\'ll help you!', { parse_mode: 'Markdown' });
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
        'telegram'
      );

      if (!result.success) {
        await ctx.reply('Sorry, I encountered an error processing your message.');
        return;
      }

      // 4. Generate reply with streaming UI
      const ui = new TelegramStreamingUI(ctx);
      const replyGenerator = new StreamingReplyGenerator(ui);
      
      let reply: string;
      if (processedMessage.messageType === 'photo') {
        reply = await replyGenerator.generatePhotoAck(processedMessage, result.context);
      } else {
        reply = await replyGenerator.generateReply(processedMessage.content, result.context);
      }

      // 5. Send final reply
      await ui.sendMessage(reply);

      // 6. Save assistant message
      await this.saveAssistantMessage(ctx, reply, result.context);

    } catch (error) {
      console.error('Error handling message:', error);
      await ctx.reply('Sorry, I encountered an error processing your message.');
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

  private async saveAssistantMessage(
    ctx: Context,
    content: string,
    context: DatabaseContext
  ) {
    try {
      // Get Telegram message ID from the last sent message
      // This is a bit tricky - we'd need to track the sent message
      // For now, we'll use a timestamp-based ID
      const gatewayMessageId = `assistant_${Date.now()}`;
      
      const processedMessage: ProcessedMessage = {
        content,
        messageType: 'text',
        gatewayType: 'telegram',
        gatewayMessageId,
        timestamp: new Date(),
      };

      await this.messagePipeline.processMessage(
        processedMessage,
        this.extractor.extractUserContext(ctx),
        'telegram'
      );
      
      console.log('💾 Assistant message saved');
    } catch (err) {
      console.error('Failed to save assistant message:', err);
    }
  }

  start() {
    if (this.status !== 'stopped') {
      console.warn('Gateway is already starting or running');
      return;
    }

    this.status = 'starting';

    this.bot.launch()
      .then(() => {
        this.status = 'running';
        console.log('🚀 Telegram gateway V2 started successfully');
      })
      .catch((error) => {
        this.status = 'stopped';
        console.error('Failed to start Telegram gateway V2:', error);
      });
  }

  stop() {
    if (this.status === 'stopped' || this.status === 'stopping') {
      return;
    }

    this.status = 'stopping';

    this.bot.stop('SIGTERM');
    this.status = 'stopped';
    console.log('🛑 Telegram gateway V2 stopped');
  }
} 