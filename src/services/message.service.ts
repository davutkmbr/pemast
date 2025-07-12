import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { messages, users, channels, projects } from "../db/schema.js";
import type {
  ProcessedMessage,
  DatabaseContext,
  MessageWithRelations,
  GatewayType,
} from "../types/index.js";

/**
 * Service for managing messages in the database
 * File uploads are handled by processors
 */
export class MessageService {
  /**
   * Save a processed message to the database
   * File creation is handled by processors, we just use the fileId from metadata
   */
  async saveMessage(
    processedMessage: ProcessedMessage,
    context: DatabaseContext,
    role: "user" | "assistant" = "user",
  ): Promise<string> {
    try {
      // Get fileId from processor metadata (processors handle file creation)
      const fileId = processedMessage.processingMetadata?.fileId || undefined;

      if (fileId) {
        console.log(`✅ Using processor-created file: ${fileId}`);
      }

      // Insert the message
      const [savedMessage] = await db
        .insert(messages)
        .values({
          projectId: context.projectId,
          userId: context.userId,
          channelId: context.channelId,
          role,
          messageType: processedMessage.messageType,
          content: processedMessage.content,
          gatewayType: processedMessage.gatewayType,
          gatewayMessageId: processedMessage.gatewayMessageId,
          fileId,
          processingMetadata: processedMessage.processingMetadata,
          processingStatus: processedMessage.processingStatus || "completed",
          createdAt: processedMessage.timestamp,
        })
        .returning({ id: messages.id });

      if (!savedMessage) {
        throw new Error("Failed to save message - no result returned");
      }

      return savedMessage.id;
    } catch (error) {
      console.error("Error saving message:", error);
      throw new Error(
        `Failed to save message: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get recent messages for a user
   */
  async getRecentMessages(
    userId: string,
    projectId: string,
    limit: number = 10,
  ): Promise<MessageWithRelations[]> {
    try {
      const recentMessages = await db.query.messages.findMany({
        where: and(eq(messages.userId, userId), eq(messages.projectId, projectId)),
        orderBy: desc(messages.createdAt),
        limit,
        with: {
          user: true,
          channel: true,
          file: true,
          project: true,
        },
      });

      // Transform the result to match our expected type
      return recentMessages.map((msg) => ({
        ...msg,
        user: msg.user || undefined,
        channel: msg.channel || undefined,
        file: msg.file || undefined,
        project: msg.project || undefined,
      })) as MessageWithRelations[];
    } catch (error) {
      console.error("Error fetching recent messages:", error);
      throw new Error(
        `Failed to fetch messages: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find last message of specific type
   */
  async findLastMessageByType(
    userId: string,
    projectId: string,
    messageType: string,
    limit: number = 5,
  ): Promise<MessageWithRelations | undefined> {
    try {
      const message = await db.query.messages.findFirst({
        where: and(
          eq(messages.userId, userId),
          eq(messages.projectId, projectId),
          eq(messages.messageType, messageType as any),
        ),
        orderBy: desc(messages.createdAt),
        with: {
          user: true,
          channel: true,
          file: true,
          project: true,
        },
      });

      if (!message) {
        return undefined;
      }

      // Transform the result to match our expected type
      return {
        ...message,
        user: message.user || undefined,
        channel: message.channel || undefined,
        file: message.file || undefined,
        project: message.project || undefined,
      } as MessageWithRelations;
    } catch (error) {
      console.error("Error finding message by type:", error);
      throw new Error(
        `Failed to find message: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get conversation context (recent messages)
   */
  async getConversationContext(
    userId: string,
    projectId: string,
    channelId: string,
    limit: number = 5,
  ): Promise<MessageWithRelations[]> {
    try {
      const contextMessages = await db.query.messages.findMany({
        where: and(
          eq(messages.userId, userId),
          eq(messages.projectId, projectId),
          eq(messages.channelId, channelId),
        ),
        orderBy: desc(messages.createdAt),
        limit,
        with: {
          user: true,
          file: true,
        },
      });

      // Transform the result to match our expected type
      return contextMessages.map((msg) => ({
        ...msg,
        user: msg.user || undefined,
        channel: undefined, // Not fetched in this query
        file: msg.file || undefined,
        project: undefined, // Not fetched in this query
      })) as unknown as MessageWithRelations[];
    } catch (error) {
      console.error("Error fetching conversation context:", error);
      throw new Error(
        `Failed to fetch context: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
