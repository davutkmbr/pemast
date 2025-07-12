import type { Context } from "telegraf";
import type { MessageProcessor } from "./types.js";

export interface GatewayConfig {
  token: string;
  [key: string]: any; // Allow platform-specific config
}

// === File Sending Types ===
export interface FileData {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  size?: number;
}

export interface FileSendOptions {
  caption?: string;
  // Platform-specific options can be added here
  [key: string]: any;
}

export type FileType = "photo" | "audio" | "voice" | "document" | "video" | "video_note";

export abstract class BaseGateway {
  protected config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  // Platform-specific implementation required
  abstract start(): void;
  abstract stop(): void;
  abstract registerProcessor(type: string, processor: MessageProcessor): void;

  // Common gateway info
  abstract getGatewayType(): string;
  abstract getStatus(): "starting" | "running" | "stopping" | "stopped";

  /**
   * Send a message to the gateway
   */
  abstract sendMessage(ctx: Context, message: string): Promise<void>;

  // === File Sending Methods ===

  /**
   * Generic file sending method - can handle any file type
   * @param ctx Platform-specific context
   * @param fileData File data including buffer, name, and metadata
   * @param fileType Type of file being sent
   * @param options Additional options like caption
   */
  abstract sendFile(
    ctx: Context,
    fileData: FileData,
    fileType: FileType,
    options?: FileSendOptions,
  ): Promise<void>;

  /**
   * Send a photo/image file
   * @param ctx Platform-specific context
   * @param fileData Image file data
   * @param options Additional options like caption
   */
  abstract sendPhoto(ctx: Context, fileData: FileData, options?: FileSendOptions): Promise<void>;

  /**
   * Send an audio file
   * @param ctx Platform-specific context
   * @param fileData Audio file data
   * @param options Additional options like caption
   */
  abstract sendAudio(ctx: Context, fileData: FileData, options?: FileSendOptions): Promise<void>;

  /**
   * Send a document/file
   * @param ctx Platform-specific context
   * @param fileData Document file data
   * @param options Additional options like caption
   */
  abstract sendDocument(ctx: Context, fileData: FileData, options?: FileSendOptions): Promise<void>;
}
