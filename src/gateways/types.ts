import type { Context } from 'telegraf';

export interface ProcessedMessage {
  text: string;
  type: string;
  metadata: {
    userId: string;
    chatId: string;
    messageId: number;
    username: string | undefined;
    firstName: string | undefined;
    lastName: string | undefined;
    timestamp: Date;
    fileId: string | undefined;
    fileName: string | undefined;
    fileSize: number | undefined;
    mimeType: string | undefined;
    // Allow processors to add additional information
    processingInfo?: {
      processor: string;
      [key: string]: any;
    };
  };
}

export interface MessageProcessor {
  processMessage(ctx: Context): Promise<ProcessedMessage>;
} 