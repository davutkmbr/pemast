import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { message } from 'telegraf/filters';

interface MessageData {
  text: string;
  metadata: {
    userId: string;
    chatId: string;
    messageId: number;
    username: string | undefined;
    firstName: string | undefined;
    lastName: string | undefined;
    timestamp: Date;
  };
}

export class TelegramGateway {
  private bot: Telegraf;

  constructor(token: string) {
    this.bot = new Telegraf(token);
    this.setupHandlers();
  }

  private setupHandlers() {
    // Handle text messages using hears instead of on('text')
    this.bot.on(message('text'), (ctx) => {
      const messageData = this.transformMessage(ctx);
      this.handleMessage(messageData);
    });

    // Handle documents/files
    this.bot.on(message('document'), (ctx) => {
      const messageData = this.transformMessage(ctx);
      this.handleMessage(messageData);
    });

    // Handle photos
    this.bot.on(message('photo'), (ctx) => {
      const messageData = this.transformMessage(ctx);
      this.handleMessage(messageData);
    });
  }

  private transformMessage(ctx: Context): MessageData {
    const message = ctx.message;
    if (!message) {
      throw new Error('No message in context');
    }

    // Extract text from different message types
    let text = '';
    if ('text' in message) {
      text = message.text;
    } else if ('caption' in message && message.caption) {
      text = message.caption;
    } else if ('document' in message) {
      text = `[Document: ${message.document?.file_name || 'unknown'}]`;
    } else if ('photo' in message) {
      text = '[Photo]';
    }

    return {
      text,
      metadata: {
        userId: message.from.id.toString(),
        chatId: message.chat.id.toString(),
        messageId: message.message_id,
        username: message.from.username,
        firstName: message.from.first_name,
        lastName: message.from.last_name,
        timestamp: new Date(message.date * 1000),
      },
    };
  }

  private async handleMessage(messageData: MessageData) {
    try {
      // TODO: This is where we'll integrate with the agent
      console.log('Received message:', messageData);
      
      // For now, just echo back
      await this.sendMessage(
        messageData.metadata.chatId,
        `Echo: ${messageData.text}`
      );
    } catch (error) {
      console.error('Error handling message:', error);
      await this.sendMessage(
        messageData.metadata.chatId,
        'Sorry, I encountered an error processing your message.'
      );
    }
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  start() {
    this.bot.launch();
    console.log('Telegram bot started');
  }

  stop() {
    this.bot.stop();
    console.log('Telegram bot stopped');
  }
}
