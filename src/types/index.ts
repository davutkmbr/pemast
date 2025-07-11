// Import centralized database types
import type { 
  GatewayType, 
  MessageType, 
  ProcessingStatus, 
  FileType,
  MessageWithRelations as DBMessageWithRelations
} from '../db/client.js';

// Re-export database types as single source of truth
export type { GatewayType, MessageType, ProcessingStatus, FileType };

// === Core Database Context ===
export interface DatabaseContext {
  projectId: string;
  userId: string;
  channelId: string;
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