import { MessageService } from './message.service.js';
import { UserService } from './user.service.js';
import { ProjectService } from './project.service.js';
import { ChannelService } from './channel.service.js';
import type { 
  ProcessedMessage, 
  DatabaseContext, 
  GatewayType, 
  UserContext,
  MessageProcessingResult 
} from '../types/index.js';

/**
 * Generic message processing service that handles the complete pipeline:
 * 1. User resolution/creation
 * 2. Project resolution/creation  
 * 3. Channel resolution/creation
 * 4. Message storage
 * 
 * This service is gateway-agnostic and can be used by any platform (Telegram, Slack, etc.)
 */
export class MessageProcessingService {
  private messageService: MessageService;
  private userService: UserService;
  private projectService: ProjectService;
  private channelService: ChannelService;

  constructor() {
    this.messageService = new MessageService();
    this.userService = new UserService();
    this.projectService = new ProjectService();
    this.channelService = new ChannelService();
  }

  /**
   * Process a message from any gateway platform
   */
  async processMessage(
    processedMessage: ProcessedMessage,
    userContext: UserContext,
    gatewayType: GatewayType
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
        this.getChatName(userContext)
      );

      // Step 4: Create database context
      const context: DatabaseContext = {
        projectId,
        userId,
        channelId,
      };

      // Step 5: Save message to database
      const messageId = await this.messageService.saveMessage(processedMessage, context);

      console.log(`✅ Message saved successfully: ${messageId}`);

      return {
        messageId,
        context,
        success: true,
      };

    } catch (error) {
      console.error('Error processing message:', error);
      
      return {
        messageId: '',
        context: { projectId: '', userId: '', channelId: '' },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get or create user based on external ID and context
   */
  private async getUserId(userContext: UserContext): Promise<string> {
    const displayName = this.buildDisplayName(userContext);
    
    return await this.userService.getOrCreateUser(
      userContext.externalUserId,
      displayName,
      undefined // email - not available from most chat platforms
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
    chatName?: string
  ): Promise<string> {
    return await this.channelService.getOrCreateChannel(
      projectId,
      gatewayType,
      externalChatId,
      chatName
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
      return parts.join(' ');
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
    limit: number = 5
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
        userContext.chatId
      );

      const context: DatabaseContext = { projectId, userId, channelId };
      
      // Get recent messages
      const recentMessages = await this.messageService.getConversationContext(
        userId,
        projectId,
        channelId,
        limit
      );

      return {
        context,
        recentMessages,
      };

    } catch (error) {
      console.error('Error getting conversation context:', error);
      return {
        context: null,
        recentMessages: [],
      };
    }
  }
} 