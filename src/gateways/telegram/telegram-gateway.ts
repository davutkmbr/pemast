import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { BaseGateway, type GatewayConfig } from '../base-gateway.js';
import { MessageRouter } from '../message-router.js';
import { TelegramExtractor } from './telegram-extractor.js';
import type { MessageProcessor } from '../types.js';

export class TelegramGateway extends BaseGateway {
  private bot: Telegraf;
  private messageRouter: MessageRouter;
  private status: 'starting' | 'running' | 'stopping' | 'stopped' = 'stopped';

  constructor(config: GatewayConfig) {
    super(config);
    this.bot = new Telegraf(config.token);
    
    // Create message router with Telegram-specific extractor
    const telegramExtractor = new TelegramExtractor();
    this.messageRouter = new MessageRouter(telegramExtractor);
    
    this.setupHandlers();
  }

  getGatewayType(): string {
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
      ctx.sendChatAction('typing')
      const response = await this.messageRouter.routeMessage(ctx, messageType);
      await this.sendMessage(ctx, response);
    } catch (error) {
      console.error('Error handling message:', error);
      await this.sendMessage(ctx, 'Sorry, I encountered an error processing your message.');
    }
  }

  private async sendMessage(ctx: Context, text: string): Promise<void> {
    try {
      await ctx.reply(text);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  start(): void {
    this.status = 'starting';
    this.bot.launch();
    this.status = 'running';
    console.log('Telegram gateway started');
  }

  stop(): void {
    this.status = 'stopping';
    this.bot.stop();
    this.status = 'stopped';
    console.log('Telegram gateway stopped');
  }
} 