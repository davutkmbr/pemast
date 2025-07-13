import { FileService } from "../services/file.service.js";
import type {
  FileReference,
  FileType,
  GatewayType,
  MessageType,
  ProcessedMessage,
} from "../types/index.js";

/**
 * Generic file processing pipeline
 * Handles: Download → Store → Process → Return ProcessedMessage
 */
export interface FileProcessorPipeline<TFile, TResult> {
  downloadFile(fileId: string, fileName: string, ...args: any[]): Promise<TFile>;
  processFile(file: TFile): Promise<TResult>;
  createProcessedMessage(
    result: TResult,
    file: TFile,
    fileReference: FileReference,
    gatewayMessageId: string,
    timestamp: Date,
    storedFileId: string,
    originalCaption?: string,
  ): ProcessedMessage;
}

/**
 * Core file processing pipeline implementation
 * Moves file storage logic to upper hierarchy
 */
export class CoreFileProcessorPipeline<TFile, TResult> {
  private fileService: FileService;

  constructor(
    private pipeline: FileProcessorPipeline<TFile, TResult>,
    private fileType: FileType,
    private messageType: MessageType, // Add separate messageType for ProcessedMessage
    private gatewayType: GatewayType,
  ) {
    this.fileService = new FileService();
  }

  /**
   * Complete file processing flow: Download → Store → Process
   */
  async processFile(
    fileId: string,
    fileName: string,
    mimeType: string,
    gatewayMessageId: string,
    timestamp: Date,
    originalCaption?: string,
    ...downloadArgs: any[]
  ): Promise<ProcessedMessage> {
    try {
      // 1. Download file using platform-specific downloader
      const file = await this.pipeline.downloadFile(fileId, fileName, ...downloadArgs);

      // 2. Store file in database + Supabase Storage (moved to upper hierarchy)
      const storedFileId = await this.storeFile(file as any, fileName, mimeType, fileId);

      // 3. Process file using AI processor
      const result = await this.pipeline.processFile(file);

      // 4. Create file reference
      const fileReference: FileReference = {
        id: fileId,
        fileName,
        mimeType,
        gateway: this.gatewayType,
      };

      // 5. Create processed message
      return this.pipeline.createProcessedMessage(
        result,
        file,
        fileReference,
        gatewayMessageId,
        timestamp,
        storedFileId,
        originalCaption,
      );
    } catch (error) {
      console.error(`Error in ${this.fileType} processing pipeline:`, error);

      // Return fallback processed message
      const fileReference: FileReference = {
        id: fileId,
        fileName,
        mimeType,
        gateway: this.gatewayType,
      };

      return {
        content: originalCaption || `[${this.fileType} processing failed]`,
        messageType: this.messageType, // Use messageType instead of fileType
        gatewayType: this.gatewayType,
        gatewayMessageId,
        timestamp,
        fileReference,
        processingMetadata: {
          processor: this.fileType,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        processingStatus: "failed",
      };
    }
  }

  /**
   * Store file in database and upload to Supabase Storage
   * Moved from individual processors to upper hierarchy
   */
  private async storeFile(
    file: { buffer: ArrayBuffer; fileName: string; mimeType: string },
    fileName: string,
    mimeType: string,
    telegramFileId: string,
  ): Promise<string> {
    try {
      const fileId = await this.fileService.createFileWithUpload(
        fileName,
        file.buffer,
        mimeType,
        this.fileType,
        telegramFileId,
        this.gatewayType,
      );

      console.log(`✅ ${this.fileType} file uploaded and stored: ${fileId} (${fileName})`);

      return fileId;
    } catch (error) {
      console.error(`Error storing ${this.fileType} file:`, error);
      throw new Error(
        `Failed to store ${this.fileType} file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
