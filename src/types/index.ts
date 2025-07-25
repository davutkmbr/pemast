// Import centralized database types
import type { ReplyGenerator } from "../core/message-pipeline.js";
import type {
  MessageWithRelations as DBMessageWithRelations,
  Reminder as DBReminder,
  UserPreference as DBUserPreference,
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
  messageId: string;
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

// === User Preferences Types ===

export type UserPreference = DBUserPreference;

export interface CreateUserPreferenceInput {
  key: string;
  value: string;
  metadata?: Record<string, any>;
}

export interface UpdateUserPreferenceInput {
  value: string;
  metadata?: Record<string, any>;
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
  // === USER IDENTITY & PERSONAL ===
  "identity", // Basic demographic info: name, age, gender, birth date, nationality
  "personal_info", // Other personal characteristics: personality, lifestyle, experiences
  "preference", // Preferences, likes/dislikes
  "skill", // Skills, abilities, expertise
  "goal", // Goals, plans, objectives

  // === WORK & PROJECTS ===
  "work", // Work, career, professional information
  "project", // Projects, tasks, work items
  "education", // Education, learning information

  // === RELATIONSHIPS ===
  "family", // Family members and relationships
  "friend", // Friends and friendships
  "colleague", // Work colleagues and professional relationships

  // === LIFE CATEGORIES ===
  "contact", // Contact information, addresses
  "location", // Address, location information
  "health", // Health-related information
  "finance", // Financial, money-related information
  "hobby", // Hobbies, interests
  "knowledge", // General knowledge, facts

  // === TEMPORAL CONTEXT ===
  "current", // Current status/situation
  "history", // Past experiences/events
  "future", // Future plans/intentions

  // === IMPORTANCE & ACTION ===
  "important", // Important information (higher priority)
  "critical", // Critical information (highest priority)
  "todo", // Tasks to be completed
  "completed", // Completed tasks/goals

  // === EMOTIONAL CONTEXT ===
  "positive", // Positive experiences/feelings
  "negative", // Negative experiences/feelings

  // === GENERAL ===
  "note", // General notes, miscellaneous
] as const;

export type MemoryCategory = (typeof CORE_MEMORY_CATEGORIES)[number];
