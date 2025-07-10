import type { Context } from 'telegraf';
import { ResponseFormatter } from './response-formatter.js';
import type { ProcessedMessage, MessageProcessor } from './types.js';

export interface MessageExtractor {
  extractMessage(ctx: any, messageType: string): ProcessedMessage;
}

export class MessageRouter {
  private processors: Map<string, MessageProcessor> = new Map();
  private messageExtractor: MessageExtractor | null = null;
  private responseFormatter: ResponseFormatter;

  constructor(extractor?: MessageExtractor) {
    this.messageExtractor = extractor || null;
    this.responseFormatter = new ResponseFormatter();
  }

  setExtractor(extractor: MessageExtractor) {
    this.messageExtractor = extractor;
  }

  registerProcessor(type: string, processor: MessageProcessor) {
    this.processors.set(type, processor);
  }

  async routeMessage(ctx: Context, messageType: string): Promise<string> {
    const processor = this.processors.get(messageType);
    
    let processedMessage: ProcessedMessage;
    
    if (processor) {
      // Use registered processor
      processedMessage = await processor.processMessage(ctx);
    } else {
      // Fallback to basic extraction
      if (!this.messageExtractor) {
        throw new Error('No message extractor configured for fallback processing');
      }
      processedMessage = this.messageExtractor.extractMessage(ctx, messageType);
    }

    // Log the processing
    console.log('Processing message:', {
      type: processedMessage.type,
      text: processedMessage.text.substring(0, 100) + '...',
      hasFile: !!processedMessage.metadata.fileId,
    });

    // Format response
    return this.responseFormatter.formatResponse(processedMessage);
  }
} 