import type { Context } from 'telegraf';
import { ResponseFormatter } from './response-formatter.js';
import { MessageProcessingService } from '../services/message-processing.service.js';
import type { MessageProcessor, MessageExtractor } from './types.js';
import type { DatabaseContext, ProcessedMessage, UserContext } from '../types/index.js';
import type { MessageProcessingResult } from '../types/index.js';
import { MainAgentService } from '../agent/main-agent.service.js';

type MessageRouterResult = {
  reply: string;
  context?: DatabaseContext;
}

export class MessageRouter {
  private processors: Map<string, MessageProcessor> = new Map();
  private messageExtractor: MessageExtractor | null = null;
  private responseFormatter: ResponseFormatter;
  private messageProcessingService: MessageProcessingService;
  private mainAgentService: MainAgentService;

  constructor(extractor?: MessageExtractor) {
    this.messageExtractor = extractor || null;
    this.responseFormatter = new ResponseFormatter();
    this.messageProcessingService = new MessageProcessingService();
    this.mainAgentService = new MainAgentService();
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

  async routeMessage(
    ctx: Context,
    messageType: string
  ): Promise<MessageRouterResult> {
    const processor = this.processors.get(messageType);
    
    let processedMessage: ProcessedMessage;
    
    if (processor) {
      // Use registered processor (voice, photo processors etc.)
      console.log(`✅ Using processor for ${messageType}`);
      processedMessage = await processor.processMessage(ctx);
    } else {
      // Fallback to basic extraction
      console.log(`⚠️ No processor found for ${messageType}, using extractor`);
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
      hasFileId: !!processedMessage.processingMetadata?.fileId,
      gateway: processedMessage.gatewayType,
    });

    // Save to database with processed content and get DB context
    const processingResult = await this.saveProcessedMessage(ctx, processedMessage);

    if (processedMessage.messageType === 'photo') {
      const ack = await this.mainAgentService.generatePhotoAck(processedMessage);
      return { reply: ack, context: processingResult.context };
    }

    // If saving succeeded, invoke the main agent with conversation context
    if (processingResult.success) {
      const replyText = await this.mainAgentService.generateReply(
        processedMessage.content,
        processingResult.context,
        { limit: 10 }
      );
      return { reply: replyText, context: processingResult.context };
    }

    // Fallback: formatted response without agent involvement
    return { reply: this.responseFormatter.formatResponse(processedMessage) };
  }

  /**
   * Save the processed message to database (with transcription, analysis etc.)
   */
  private async saveProcessedMessage(
    ctx: Context,
    processedMessage: ProcessedMessage
  ): Promise<MessageProcessingResult> {
    try {
      if (!this.messageExtractor) {
        console.error('No message extractor available for user context');
        return {
          messageId: '',
          context: { projectId: '', userId: '', channelId: '' },
          success: false,
          error: 'No message extractor available for user context',
        };
      }

      // Extract user context
      const userContext: UserContext = this.messageExtractor.extractUserContext(ctx);
      
      // Save to database using processed content (not fallback)
      const result = await this.messageProcessingService.processMessage(
        processedMessage,
        userContext,
        'telegram'
      );
      
      if (result.success) {
        console.log(`💾 Processed message saved to database: ${result.messageId}`);
      } else {
        console.error(`❌ Failed to save processed message: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('Error saving processed message to database:', error);
      return {
        messageId: '',
        context: { projectId: '', userId: '', channelId: '' },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
} 