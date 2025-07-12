// Import centralized database types
import type { ReplyGenerator } from "../core/message-pipeline.js";
import type {
  MessageWithRelations as DBMessageWithRelations,
  Reminder as DBReminder,
  FileType,
  GatewayType,
  MessageType,
  ProcessingStatus,
  RecurrenceType,
} from "../db/client.js";

// Import gateway for context
import type { BaseGateway } from "../gateways/base-gateway.js";

// Re-export database types as single source of truth
export type { GatewayType, MessageType, ProcessingStatus, FileType, RecurrenceType };

// === Core Database Context ===
export interface DatabaseContext {
  projectId: string;
  userId: string;
  channelId: string;
}

// === Extended Gateway Context for Tools ===
export interface GatewayContext extends DatabaseContext {
  gateway: BaseGateway;
  replyGenerator: ReplyGenerator;
  originalContext?: any; // Platform-specific context (e.g. Telegram Context)
}

// === User Context for Gateway Processing ===
export interface UserContext {
  externalUserId: string;
  chatId: string;
  username?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
}

// === File Handling ===
export interface FileReference {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize?: number | undefined;
  gateway: GatewayType;
}

export interface FileStorageResult {
  fileId: string;
  storagePath: string;
  url?: string | undefined;
}

// === Modern Message Processing (Clean Interface) ===
export interface ProcessedMessage {
  content: string;
  messageType: MessageType;
  gatewayType: GatewayType;
  gatewayMessageId: string;
  timestamp: Date;
  fileReference?: FileReference | undefined;
  processingMetadata?: Record<string, any> | undefined;
  processingStatus?: ProcessingStatus | undefined;
}

export interface MessageProcessingResult {
  messageId: string;
  context: DatabaseContext;
  success: boolean;
  error?: string | undefined;
}

// === Database Entity Creation ===
export interface NewMessage {
  projectId: string;
  userId: string;
  channelId: string;
  messageType: MessageType;
  content: string;
  gatewayType: GatewayType;
  gatewayMessageId: string;
  fileId?: string | undefined;
  processingMetadata?: Record<string, any> | undefined;
  processingStatus?: ProcessingStatus | undefined;
  parentMessageId?: string | undefined;
  threadId?: string | undefined;
  createdAt?: Date | undefined;
}

export interface NewFile {
  originalName: string;
  storagePath?: string | undefined;
  mimeType: string;
  fileSize?: number | undefined;
  fileType: FileType;
  gatewayFileId?: string | undefined;
  gatewayType?: GatewayType | undefined;
  checksum?: string | undefined;
  isProcessed?: boolean | undefined;
}

// === Query Results with Relations ===
export type MessageWithRelations = DBMessageWithRelations;

// === Memory Types ===
export interface Memory {
  id: string;
  projectId: string | null;
  userId: string | null;
  messageId: string | null;
  content: string;
  summary?: string | null;
  embedding?: number[] | null;
  fileId?: string | null;
  metadata?: Record<string, any> | null;
  tags?: string[] | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface MemoryWithRelations extends Memory {
  user?: any;
  project?: any;
  message?: any;
  file?: any;
}

export interface CreateMemoryInput {
  messageId: string;
  content: string;
  summary?: string;
  fileId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

// === Reminder Types ===

export type Reminder = DBReminder;

export interface CreateReminderInput {
  messageId: string;
  content: string;
  summary?: string;
  scheduledFor: Date;
  tags?: string[];
  recurrence?: {
    type: RecurrenceType;
    interval?: number;
    endDate?: Date;
  };
}

export interface VectorSearchResult<T> {
  item: T;
  similarity: number;
  distance: number;
}

/**
 * Core memory categories - fixed list for consistent categorization
 * All memories must include at least one of these categories
 */
export const CORE_MEMORY_CATEGORIES = [
  "personal_info", // Personal information, identity details
  "work", // Work, career, professional information
  "preference", // Preferences, likes/dislikes
  "skill", // Skills, abilities, expertise
  "project", // Projects, tasks, work items
  "contact", // Contact information, addresses
  "location", // Address, location information
  "health", // Health-related information
  "finance", // Financial, money-related information
  "family", // Family, close relationships
  "education", // Education, learning information
  "hobby", // Hobbies, interests
  "goal", // Goals, plans, objectives
  "fact", // General facts, knowledge
  "note", // General notes, miscellaneous
] as const;

export type MemoryCategory = (typeof CORE_MEMORY_CATEGORIES)[number];
