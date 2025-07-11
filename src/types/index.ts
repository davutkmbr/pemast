// Import database types
import type {
  Message,
  NewMessage,
  File,
  NewFile,
  User,
  Project,
  Channel,
  Memory,
  Fact,
  Reminder,
  GatewayType,
  MessageType,
  FileType,
  ProcessingStatus,
  ProcessingMetadata,
  MessageWithRelations,
  MemoryWithRelations,
  RecurrenceType,
} from '../db/client.js';

// Re-export database types
export type {
  Message,
  NewMessage,
  File,
  NewFile,
  User,
  Project,
  Channel,
  Memory,
  Fact,
  Reminder,
  GatewayType,
  MessageType,
  FileType,
  ProcessingStatus,
  ProcessingMetadata,
  MessageWithRelations,
  MemoryWithRelations,
  RecurrenceType,
};

// === GATEWAY INTERFACE ===
/**
 * Generic file reference for cross-platform file handling
 */
export interface FileReference {
  id: string;              // Platform-specific file ID
  fileName: string;
  fileSize: number | undefined;
  mimeType: string;
  gateway: GatewayType;    // Use database enum
  downloadUrl?: string;    // Direct URL if available
  metadata?: {             // Platform-specific download info
    [key: string]: any;
  };
}

/**
 * Processed message that can be converted to database Message
 */
export interface ProcessedMessage {
  // Core content
  content: string;
  messageType: MessageType; // Use database enum
  
  // Gateway context
  gatewayType: GatewayType;
  gatewayMessageId: string;
  
  // User context (will be resolved to database IDs)
  userContext: {
    externalUserId: string;
    chatId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  
  // File attachment (optional)
  fileReference?: FileReference;
  
  // Processing metadata
  processingMetadata?: ProcessingMetadata;
  processingStatus?: ProcessingStatus;
  
  // Timestamps
  timestamp: Date;
}

/**
 * Message processor interface for different message types
 */
export interface MessageProcessor {
  processMessage(ctx: any): Promise<ProcessedMessage>;
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  token: string;
  [key: string]: any;
}

/**
 * Base gateway interface
 */
export interface BaseGatewayInterface {
  getGatewayType(): GatewayType;
  getStatus(): 'starting' | 'running' | 'stopping' | 'stopped';
  registerProcessor(type: string, processor: MessageProcessor): void;
  start(): void;
  stop(): void;
}

// === SERVICE LAYER TYPES ===
/**
 * Context for database operations
 */
export interface DatabaseContext {
  projectId: string;
  userId: string;
  channelId: string;
}

/**
 * File storage result
 */
export interface FileStorageResult {
  fileId: string;
  storagePath: string;
  publicUrl?: string;
}

/**
 * Memory creation input
 */
export interface CreateMemoryInput {
  content: string;
  summary?: string;
  messageId: string;
  fileId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Fact creation input
 */
export interface CreateFactInput {
  keyText: string;
  valueText: string;
  messageId: string;
  confidence?: number;
}

/**
 * Reminder creation input
 */
export interface CreateReminderInput {
  content: string;
  scheduledFor: Date;
  messageId: string;
  // Semantic search fields
  summary?: string; // Brief description for better search
  tags?: string[];  // Categorization tags ["birthday", "friend", "fettah"]
  // Recurrence configuration
  recurrence?: {
    type: RecurrenceType;
    interval?: number; // Every N intervals (default: 1)
    endDate?: Date;    // When to stop creating recurring instances
  };
}

// === SEARCH & QUERY TYPES ===
/**
 * Vector search result
 */
export interface VectorSearchResult<T = any> {
  item: T;
  similarity: number;
  distance: number;
}

/**
 * Search filters
 */
export interface SearchFilters {
  fileTypes?: FileType[];
  messageTypes?: MessageType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  userId?: string;
}

// === ERROR TYPES ===
export class DatabaseError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ProcessingError extends Error {
  constructor(message: string, public processor?: string, public cause?: Error) {
    super(message);
    this.name = 'ProcessingError';
  }
}

export class GatewayError extends Error {
  constructor(message: string, public gateway?: string, public cause?: Error) {
    super(message);
    this.name = 'GatewayError';
  }
}

// === UTILITY TYPES ===
/**
 * Make properties optional except for specified keys
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Database record with timestamps
 */
export type WithTimestamps = {
  createdAt: Date;
  updatedAt?: Date;
};

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
} 