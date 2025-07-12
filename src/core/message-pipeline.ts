import type { MessageProcessingService } from "../services/message-processing.service.js";
import type {
  DatabaseContext,
  GatewayContext,
  GatewayType,
  MessageProcessingResult,
  ProcessedMessage,
  UserContext,
} from "../types/index.js";

/**
 * Platform-agnostic message processing pipeline
 * Handles the complete flow: Process → Save → Generate Reply
 */
export interface MessagePipeline {
  processMessage(
    processedMessage: ProcessedMessage,
    userContext: UserContext,
    gatewayType: GatewayType,
  ): Promise<MessageProcessingResult>;

  generateReply(messageContent: string, context: DatabaseContext): Promise<string>;
}

/**
 * Reply generation interface - decoupled from any UI framework
 */
export interface ReplyGenerator {
  generateReply(
    messageContent: string,
    context: DatabaseContext | GatewayContext,
    options?: { limit?: number },
  ): Promise<string>;

  generatePhotoAck(
    processedMessage: ProcessedMessage,
    context: DatabaseContext | GatewayContext,
  ): Promise<string>;
}

/**
 * Platform-specific UI streaming interface
 */
export interface StreamingUI {
  sendMessage(content: string): Promise<void>;
  sendTyping(): Promise<void>;
  onToolStart(toolName: string): Promise<void>;
  onToolResult(): Promise<void>;
  onStatus(status: string): Promise<void>;
}

/**
 * Core message pipeline implementation
 */
export class CoreMessagePipeline implements MessagePipeline {
  constructor(
    private messageProcessingService: MessageProcessingService,
    private replyGenerator: ReplyGenerator,
  ) {}

  async processMessage(
    processedMessage: ProcessedMessage,
    userContext: UserContext,
    gatewayType: GatewayType,
  ): Promise<MessageProcessingResult> {
    return this.messageProcessingService.processMessage(processedMessage, userContext, gatewayType);
  }

  async generateReply(messageContent: string, context: DatabaseContext): Promise<string> {
    return this.replyGenerator.generateReply(messageContent, context);
  }
}
