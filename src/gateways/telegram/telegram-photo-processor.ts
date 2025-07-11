import type { Context } from 'telegraf';
import type { MessageProcessor } from '../types.js';
import type { ProcessedMessage, FileReference } from '../../types/index.js';
import { PhotoProcessor, type ImageFile } from '../../processors/photo.processor.js';
import { FileService } from '../../services/file.service.js';

export interface TelegramPhotoProcessorConfig {
  photoProcessor: PhotoProcessor;
  telegramBotToken: string;
}

export class TelegramPhotoProcessor implements MessageProcessor {
  private photoProcessor: PhotoProcessor;
  private telegramBotToken: string;
  private fileService: FileService;

  constructor(config: TelegramPhotoProcessorConfig) {
    this.photoProcessor = config.photoProcessor;
    this.telegramBotToken = config.telegramBotToken;
    this.fileService = new FileService();
  }

  async processMessage(ctx: Context): Promise<ProcessedMessage> {
    const message = ctx.message;
    if (!message) {
      throw new Error('No message in context');
    }

    if (!('photo' in message)) {
      throw new Error('Message does not contain a photo');
    }

    try {
      // Get the largest photo (best quality)
      const photos = message.photo;
      const largestPhoto = photos[photos.length - 1];
      
      if (!largestPhoto) {
        throw new Error('No photo found in message');
      }

      const fileId = largestPhoto.file_id;
      const fileName = `photo_${Date.now()}.jpg`;
      const fileSize = largestPhoto.file_size;
      const caption = message.caption;
      
      // Download the photo from Telegram
      const imageFile = await this.downloadTelegramPhoto(fileId, fileName, fileSize);
      
      // Store the file in database and get fileId
      const storedFileId = await this.storePhotoFile(imageFile, fileId);
      
      // Analyze using the generic photo processor
      const photoResult = await this.photoProcessor.analyzeImage(imageFile);
      
      // Create file reference
      const fileReference: FileReference = {
        id: fileId,
        fileName,
        mimeType: 'image/jpeg',
        fileSize,
        gateway: 'telegram',
      };

      // Return modern ProcessedMessage with analysis
      return {
        content: photoResult.summary || caption || '[Photo analyzed]',
        messageType: 'photo', // Photo messages now directly trigger memory creation
        gatewayType: 'telegram',
        gatewayMessageId: message.message_id.toString(),
        timestamp: new Date(message.date * 1000),
        fileReference,
        processingMetadata: {
          processor: 'photo',
          fileId: storedFileId, // Include fileId for memory linking
          contentType: photoResult.contentType,
          summary: photoResult.summary,
          description: photoResult.description,
          extractedText: photoResult.extractedText,
          keyInsights: photoResult.keyInsights,
          confidence: photoResult.confidence,
          originalCaption: caption,
          imageSize: fileSize,
          processingTimestamp: new Date().toISOString(),
        },
        processingStatus: 'completed',
      };
      
    } catch (error) {
      console.error('Error processing photo message:', error);
      
      // Return fallback message on processing failure
      const largestPhoto = message.photo[message.photo.length - 1];
      const fileReference: FileReference | undefined = largestPhoto ? {
        id: largestPhoto.file_id,
        fileName: `photo_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        fileSize: largestPhoto.file_size,
        gateway: 'telegram',
      } : undefined;

      return {
        content: message.caption || '[Photo processing failed]',
        messageType: 'photo',
        gatewayType: 'telegram',
        gatewayMessageId: message.message_id.toString(),
        timestamp: new Date(message.date * 1000),
        fileReference,
        processingMetadata: {
          processor: 'photo',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        processingStatus: 'failed',
      };
    }
  }

  /**
   * Store photo file in database and upload to Supabase Storage
   */
  private async storePhotoFile(imageFile: ImageFile, telegramFileId: string): Promise<string> {
    try {
      const fileId = await this.fileService.createFileWithUpload(
        imageFile.fileName,
        imageFile.buffer,
        imageFile.mimeType,
        'photo',
        telegramFileId,
        'telegram'
      );
      
      console.log(`✅ Photo file uploaded and stored: ${fileId} (${imageFile.fileName})`);
      
      return fileId;
    } catch (error) {
      console.error('Error storing photo file:', error);
      throw new Error(`Failed to store photo file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async downloadTelegramPhoto(
    fileId: string,
    fileName: string,
    fileSize?: number
  ): Promise<ImageFile> {
    try {
      // Get file info from Telegram
      const fileResponse = await fetch(
        `https://api.telegram.org/bot${this.telegramBotToken}/getFile?file_id=${fileId}`
      );
      
      if (!fileResponse.ok) {
        throw new Error(`Failed to get file info: ${fileResponse.statusText}`);
      }
      
      const fileData = await fileResponse.json() as any;
      
      if (!fileData.ok || !fileData.result?.file_path) {
        throw new Error('Invalid file data from Telegram API');
      }
      
      // Download the file
      const photoResponse = await fetch(
        `https://api.telegram.org/file/bot${this.telegramBotToken}/${fileData.result.file_path}`
      );
      
      if (!photoResponse.ok) {
        throw new Error(`Failed to download photo file: ${photoResponse.statusText}`);
      }
      
      const photoBuffer = await photoResponse.arrayBuffer();
      
      return {
        buffer: photoBuffer,
        fileName,
        mimeType: 'image/jpeg', // Telegram photos are typically JPEG
        size: fileSize,
      };
      
    } catch (error) {
      console.error('Error downloading Telegram photo:', error);
      throw error;
    }
  }
} 