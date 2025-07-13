import type {
  CreateMemoryInput,
  DatabaseContext,
  GatewayType,
  MessageProcessingResult,
  ProcessedMessage,
  UserContext,
} from "../types/index.js";
import { ChannelService } from "./channel.service.js";
import { MemoryService } from "./memory.service.js";
import { MessageService } from "./message.service.js";
import { ProjectService } from "./project.service.js";
import { UserService } from "./user.service.js";

/**
 * Generic message processing service that handles the complete pipeline:
 * 1. User resolution/creation
 * 2. Project resolution/creation
 * 3. Channel resolution/creation
 * 4. Message storage
 * 5. Memory creation (for file-based content)
 *
 * This service is gateway-agnostic and can be used by any platform (Telegram, Slack, etc.)
 */
export class MessageProcessingService {
  private messageService: MessageService;
  private userService: UserService;
  private projectService: ProjectService;
  private channelService: ChannelService;
  private memoryService: MemoryService;

  constructor() {
    this.messageService = new MessageService();
    this.userService = new UserService();
    this.projectService = new ProjectService();
    this.channelService = new ChannelService();
    this.memoryService = new MemoryService();
  }

  /**
   * Process a message from any gateway platform
   */
  async processMessage(
    processedMessage: ProcessedMessage,
    userContext: UserContext,
    gatewayType: GatewayType,
  ): Promise<MessageProcessingResult> {
    try {
      console.log(`Processing ${gatewayType} message from user ${userContext.externalUserId}`);

      // Step 1: Get or create user
      const userId = await this.getUserId(userContext);

      // Step 2: Get or create project
      const projectId = await this.getProjectId(userId, gatewayType);

      // Step 3: Get or create channel
      const channelId = await this.getChannelId(
        projectId,
        gatewayType,
        userContext.chatId,
        this.getChatName(userContext),
      );

      // Step 4: Create database context
      const context: DatabaseContext = {
        projectId,
        userId,
        channelId,
      };

      // Step 5: Save message to database
      const messageId = await this.messageService.saveMessage(processedMessage, context, "user");

      // Step 6: Create memory for file-based content (photos, documents, audio files)
      if (this.shouldCreateMemory(processedMessage)) {
        await this.createMemoryFromMessage(messageId, processedMessage, context);
      }

      console.log(`✅ Message saved successfully: ${messageId}`);

      return {
        messageId,
        context,
        success: true,
      };
    } catch (error) {
      console.error("Error processing message:", error);

      return {
        messageId: "",
        context: { projectId: "", userId: "", channelId: "" },
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Determine if a message should create a memory record
   * Strategy: Voice messages → NO memory (just transcript in messages.content)
   *          Photos, documents, audio files → YES memory (processed summary)
   */
  private shouldCreateMemory(message: ProcessedMessage): boolean {
    // Voice messages only get transcription in messages.content, no memory
    if (message.messageType === "voice") {
      return false;
    }

    // Documents and other file attachments (except voice) get memories
    if (message.fileReference) {
      return true;
    }

    return false;
  }

  /**
   * Create memory from processed message content
   */
  private async createMemoryFromMessage(
    messageId: string,
    message: ProcessedMessage,
    context: DatabaseContext,
  ): Promise<void> {
    try {
      const metadata = message.processingMetadata || {};

      // Extract summary and insights from processing metadata
      const summary = this.extractSummary(message, metadata);
      const tags = this.extractTags(message, metadata);

      const memoryInput: CreateMemoryInput = {
        messageId,
        content: this.buildMemoryContent(message, metadata),
        summary,
        fileId: metadata.fileId || undefined,
        metadata: {
          processor: metadata.processor,
          contentType: metadata.contentType,
          extractedText: metadata.extractedText,
          keyInsights: metadata.keyInsights,
          confidence: metadata.confidence,
          originalFileName: message.fileReference?.fileName,
          mimeType: message.fileReference?.mimeType,
          processingTimestamp: new Date().toISOString(),
        },
        tags,
      };

      const memoryId = await this.memoryService.createMemory(memoryInput, context);
      console.log(`✅ Memory created for message ${messageId}: ${memoryId}`);
    } catch (error) {
      console.error("Error creating memory from message:", error);
      // Don't throw - memory creation failure shouldn't break message processing
    }
  }

  /**
   * Build comprehensive memory content from message and metadata
   */
  private buildMemoryContent(message: ProcessedMessage, metadata: any): string {
    const parts: string[] = [];

    // Add analyzed photo summary
    if (message.content && message.content !== "[Photo analyzed]") {
      parts.push(`Content: ${message.content}`);
    }

    // Add original caption
    if (message.processingMetadata?.originalCaption) {
      parts.push(`Original Caption: ${message.processingMetadata.originalCaption}`);
    }

    // Add extracted text (OCR, document parsing)
    if (metadata.extractedText) {
      parts.push(`Extracted Text: ${metadata.extractedText}`);
    }

    // Add AI-generated description
    if (metadata.description) {
      parts.push(`Description: ${metadata.description}`);
    }

    // Add key insights
    if (metadata.keyInsights && Array.isArray(metadata.keyInsights)) {
      parts.push(`Key Insights: ${metadata.keyInsights.join(", ")}`);
    }

    // Add file information
    if (message.fileReference) {
      parts.push(`File: ${message.fileReference.fileName} (${message.fileReference.mimeType})`);
    }

    return parts.join("\n\n");
  }

  /**
   * Extract summary for memory from processing results
   */
  private extractSummary(message: ProcessedMessage, metadata: any): string {
    // Use AI-generated summary if available
    if (metadata.summary) {
      return metadata.summary;
    }

    // For photos, use description as summary
    if (metadata.description) {
      return metadata.description;
    }

    // Fallback to content summary
    if (message.content && message.content.length > 100) {
      return message.content.substring(0, 97) + "...";
    }

    return message.content || "Processed file content";
  }

  /**
   * Extract tags from processing metadata and content
   */
  private extractTags(message: ProcessedMessage, metadata: any): string[] {
    const tags: string[] = [];

    // Add processor type as tag
    if (metadata.processor) {
      tags.push(metadata.processor);
    }

    // Add content type as tag
    if (metadata.contentType) {
      tags.push(metadata.contentType);
    }

    // Add file type based on mime type
    if (message.fileReference?.mimeType) {
      const mimeType = message.fileReference.mimeType;
      if (mimeType.startsWith("image/")) tags.push("image");
      if (mimeType.startsWith("audio/")) tags.push("audio");
      if (mimeType.startsWith("video/")) tags.push("video");
      if (mimeType.includes("pdf")) tags.push("pdf");
      if (mimeType.includes("document")) tags.push("document");
    }

    // Add message type as tag
    tags.push(message.messageType);

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Get or create user based on external ID and context
   */
  private async getUserId(userContext: UserContext): Promise<string> {
    const displayName = this.buildDisplayName(userContext);

    return await this.userService.getOrCreateUser(
      userContext.externalUserId,
      displayName,
      undefined, // email - not available from most chat platforms
    );
  }

  /**
   * Get or create default project for user
   */
  private async getProjectId(userId: string, gatewayType: GatewayType): Promise<string> {
    return await this.projectService.getOrCreateDefaultProject(userId, gatewayType);
  }

  /**
   * Get or create channel for the chat
   */
  private async getChannelId(
    projectId: string,
    gatewayType: GatewayType,
    externalChatId: string,
    chatName?: string,
  ): Promise<string> {
    return await this.channelService.getOrCreateChannel(
      projectId,
      gatewayType,
      externalChatId,
      chatName,
    );
  }

  /**
   * Build a display name from user context
   */
  private buildDisplayName(userContext: UserContext): string {
    const parts: string[] = [];

    if (userContext.firstName) parts.push(userContext.firstName);
    if (userContext.lastName) parts.push(userContext.lastName);

    if (parts.length > 0) {
      return parts.join(" ");
    }

    if (userContext.username) {
      return `@${userContext.username}`;
    }

    return `User ${userContext.externalUserId}`;
  }

  /**
   * Generate a chat name from context
   */
  private getChatName(userContext: UserContext): string {
    const displayName = this.buildDisplayName(userContext);
    return `Chat with ${displayName}`;
  }

  /**
   * Get recent conversation context for a user
   */
  async getConversationContext(
    userContext: UserContext,
    gatewayType: GatewayType,
    limit: number = 5,
  ): Promise<{
    context: DatabaseContext | null;
    recentMessages: any[];
  }> {
    try {
      // Try to find existing context
      const userId = await this.userService.getOrCreateUser(userContext.externalUserId);
      const projectId = await this.projectService.getOrCreateDefaultProject(userId, gatewayType);
      const channelId = await this.channelService.getOrCreateChannel(
        projectId,
        gatewayType,
        userContext.chatId,
      );

      const context: DatabaseContext = { projectId, userId, channelId };

      // Get recent messages
      const recentMessages = await this.messageService.getConversationContext(
        userId,
        projectId,
        channelId,
        limit,
      );

      return {
        context,
        recentMessages,
      };
    } catch (error) {
      console.error("Error getting conversation context:", error);
      return {
        context: null,
        recentMessages: [],
      };
    }
  }
}
