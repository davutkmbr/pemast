import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { BaseGateway, type GatewayConfig } from '../base-gateway.js';
import { MessageRouter } from '../message-router.js';
import { TelegramExtractor } from './telegram-extractor.js';
import { MessageProcessingService } from '../../services/message-processing.service.js';
import type { MessageProcessor } from '../types.js';

export class TelegramGateway extends BaseGateway {
  private bot: Telegraf;
  private messageRouter: MessageRouter;
  private messageProcessingService: MessageProcessingService;
  private telegramExtractor: TelegramExtractor;
  private status: 'starting' | 'running' | 'stopping' | 'stopped' = 'stopped';

  constructor(config: GatewayConfig) {
    super(config);
    this.bot = new Telegraf(config.token);
    
    // Create Telegram-specific extractor
    this.telegramExtractor = new TelegramExtractor();
    
    // Create message router with Telegram extractor
    this.messageRouter = new MessageRouter(this.telegramExtractor);
    
    // Initialize generic message processing service
    this.messageProcessingService = new MessageProcessingService();
    
    this.setupHandlers();
  }

  getGatewayType(): 'telegram' {
    return 'telegram';
  }

  getStatus(): 'starting' | 'running' | 'stopping' | 'stopped' {
    return this.status;
  }

  registerProcessor(type: string, processor: MessageProcessor): void {
    this.messageRouter.registerProcessor(type, processor);
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
        'Just send me any message and I\'ll help you!');
    });
  }

  private async handleMessage(ctx: Context, messageType: string) {
    try {
      ctx.sendChatAction('typing');
      
      // Process message for AI response
      const response = await this.messageRouter.routeMessage(ctx, messageType);
      
      // Process message for database storage
      await this.saveMessageToDatabase(ctx, messageType);
      
      // Send response to user
      await this.sendMessage(ctx, response);
      
    } catch (error) {
      console.error('Error handling message:', error);
      await this.sendMessage(ctx, 'Sorry, I encountered an error processing your message.');
    }
  }

  /**
   * Save message to database using the modern pipeline
   */
  private async saveMessageToDatabase(ctx: Context, messageType: string) {
    try {
      // Extract message and user context
      const processedMessage = await this.telegramExtractor.extractMessage(ctx, messageType);
      const userContext = this.telegramExtractor.extractUserContext(ctx);
      
      // Save to database using generic service
      const result = await this.messageProcessingService.processMessage(
        processedMessage,
        userContext,
        'telegram'
      );
      
      if (result.success) {
        console.log(`💾 Message saved to database: ${result.messageId}`);
      } else {
        console.error(`❌ Failed to save message: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving message to database:', error);
    }
  }

  private async sendMessage(ctx: Context, message: string) {
    try {
      // Split long messages if needed
      const maxLength = 4096; // Telegram's message limit
      if (message.length <= maxLength) {
        await ctx.reply(message);
      } else {
        // Split into chunks
        const chunks = this.splitMessage(message, maxLength);
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  private splitMessage(message: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    
    const lines = message.split('\n');
    
    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If a single line is too long, split it
        if (line.length > maxLength) {
          const lineChunks = line.match(new RegExp(`.{1,${maxLength - 10}}`, 'g')) || [];
          chunks.push(...lineChunks);
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
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
        console.log('🚀 Telegram gateway started successfully');
      })
      .catch((error) => {
        this.status = 'stopped';
        console.error('Failed to start Telegram gateway:', error);
      });
  }

  stop() {
    if (this.status === 'stopped' || this.status === 'stopping') {
      return;
    }

    this.status = 'stopping';
    
    this.bot.stop('SIGTERM');
    this.status = 'stopped';
    console.log('🛑 Telegram gateway stopped');
  }
} 