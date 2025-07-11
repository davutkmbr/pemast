import type { Context } from 'telegraf';
import { ResponseFormatter } from './response-formatter.js';
import type { MessageProcessor, MessageExtractor } from './types.js';
import type { ProcessedMessage } from '../types/index.js';

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

  getProcessor(type: string): MessageProcessor | undefined {
    return this.processors.get(type);
  }

  getExtractor(): MessageExtractor | null {
    return this.messageExtractor;
  }

  async routeMessage(ctx: Context, messageType: string): Promise<string> {
    const processor = this.processors.get(messageType);
    
    let processedMessage: ProcessedMessage;
    
    if (processor) {
      // Use registered processor (voice, photo processors etc.)
      processedMessage = await processor.processMessage(ctx);
    } else {
      // Fallback to basic extraction
      if (!this.messageExtractor) {
        throw new Error('No message extractor configured for fallback processing');
      }
      processedMessage = await this.messageExtractor.extractMessage(ctx, messageType);
    }

    // Log the processing
    console.log('Processing message:', {
      type: processedMessage.messageType,
      content: processedMessage.content.substring(0, 100) + '...',
      hasFile: !!processedMessage.fileReference,
      gateway: processedMessage.gatewayType,
    });

    // Format response using modern formatter
    return this.responseFormatter.formatResponse(processedMessage);
  }
} 