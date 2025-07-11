import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { channels } from '../db/schema.js';
import type { GatewayType } from '../types/index.js';

export interface CreateChannelParams {
  projectId: string;
  gatewayType: GatewayType;
  externalChatId: string;
  name?: string;
}

export interface ChannelInfo {
  id: string;
  projectId: string;
  gatewayType: GatewayType;
  externalChatId: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Service for managing channels (gateway-specific chat connections)
 */
export class ChannelService {
  
  /**
   * Create a new channel
   */
  async createChannel(params: CreateChannelParams): Promise<string> {
    try {
      const [createdChannel] = await db.insert(channels).values({
        projectId: params.projectId,
        gatewayType: params.gatewayType,
        externalChatId: params.externalChatId,
        name: params.name,
      }).returning({ id: channels.id });

      if (!createdChannel) {
        throw new Error('Failed to create channel - no result returned');
      }

      return createdChannel.id;
    } catch (error) {
      console.error('Error creating channel:', error);
      throw new Error(`Failed to create channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create a channel for a specific chat
   * This is used when messages come from gateway platforms
   */
  async getOrCreateChannel(
    projectId: string,
    gatewayType: GatewayType,
    externalChatId: string,
    chatName?: string
  ): Promise<string> {
    try {
      // Look for existing channel
      const [existingChannel] = await db
        .select({ id: channels.id })
        .from(channels)
        .where(and(
          eq(channels.projectId, projectId),
          eq(channels.gatewayType, gatewayType),
          eq(channels.externalChatId, externalChatId)
        ))
        .limit(1);

      if (existingChannel) {
        return existingChannel.id;
      }

      // Create new channel
      const channelId = await this.createChannel({
        projectId,
        gatewayType,
        externalChatId,
        name: chatName || `${gatewayType} Chat ${externalChatId}`,
      });

      return channelId;
    } catch (error) {
      console.error('Error getting or creating channel:', error);
      throw new Error(`Failed to get channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get channel by ID
   */
  async getChannel(channelId: string): Promise<ChannelInfo | null> {
    try {
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        return null;
      }

      return {
        id: channel.id,
        projectId: channel.projectId!,  // Non-null assertion since it's required in DB
        gatewayType: channel.gatewayType,
        externalChatId: channel.externalChatId,
        name: channel.name,
        isActive: channel.isActive ?? true,
        createdAt: channel.createdAt ?? new Date(),
      };
    } catch (error) {
      console.error('Error fetching channel:', error);
      throw new Error(`Failed to fetch channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get channel by external chat ID and gateway
   */
  async getChannelByExternalId(
    gatewayType: GatewayType,
    externalChatId: string
  ): Promise<ChannelInfo | null> {
    try {
      const [channel] = await db
        .select()
        .from(channels)
        .where(and(
          eq(channels.gatewayType, gatewayType),
          eq(channels.externalChatId, externalChatId)
        ))
        .limit(1);

      if (!channel) {
        return null;
      }

      return {
        id: channel.id,
        projectId: channel.projectId!,  // Non-null assertion since it's required in DB
        gatewayType: channel.gatewayType,
        externalChatId: channel.externalChatId,
        name: channel.name,
        isActive: channel.isActive ?? true,
        createdAt: channel.createdAt ?? new Date(),
      };
    } catch (error) {
      console.error('Error fetching channel by external ID:', error);
      throw new Error(`Failed to fetch channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update channel name
   */
  async updateChannelName(channelId: string, name: string): Promise<void> {
    try {
      await db
        .update(channels)
        .set({ name })
        .where(eq(channels.id, channelId));
    } catch (error) {
      console.error('Error updating channel name:', error);
      throw new Error(`Failed to update channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deactivate a channel
   */
  async deactivateChannel(channelId: string): Promise<void> {
    try {
      await db
        .update(channels)
        .set({ isActive: false })
        .where(eq(channels.id, channelId));
    } catch (error) {
      console.error('Error deactivating channel:', error);
      throw new Error(`Failed to deactivate channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 