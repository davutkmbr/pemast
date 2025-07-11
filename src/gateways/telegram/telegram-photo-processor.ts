import type { Context } from 'telegraf';
import type { MessageProcessor, ProcessedMessage } from '../types.js';
import { PhotoProcessor, type ImageFile } from '../../processors/photo.processor.js';

export interface TelegramPhotoProcessorConfig {
  photoProcessor: PhotoProcessor;
  telegramBotToken: string;
}

export class TelegramPhotoProcessor implements MessageProcessor {
  private photoProcessor: PhotoProcessor;
  private telegramBotToken: string;

  constructor(config: TelegramPhotoProcessorConfig) {
    this.photoProcessor = config.photoProcessor;
    this.telegramBotToken = config.telegramBotToken;
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
      
      // Analyze using the generic photo processor
      const photoResult = await this.photoProcessor.analyzeImage(imageFile);
      
      // Return processed message with analysis (formatting handled by ResponseFormatter)
      return {
        text: photoResult.summary, // Brief summary for text field
        type: 'photo',
        metadata: {
          userId: message.from.id.toString(),
          chatId: message.chat.id.toString(),
          messageId: message.message_id,
          username: message.from.username,
          firstName: message.from.first_name,
          lastName: message.from.last_name,
          timestamp: new Date(message.date * 1000),
          fileId,
          fileName,
          fileSize: fileSize,
          mimeType: 'image/jpeg',
          processingInfo: {
            processor: 'photo',
            contentType: photoResult.contentType,
            summary: photoResult.summary,
            description: photoResult.description,
            extractedText: photoResult.extractedText,
            keyInsights: photoResult.keyInsights,
            confidence: photoResult.confidence,
            error: photoResult.error,
            caption: caption,
          },
        },
      };
      
    } catch (error) {
      console.error('Error processing photo message:', error);
      
      // Return fallback message on processing failure
      return {
        text: '[Photo processing failed]',
        type: 'photo',
        metadata: {
          userId: message.from.id.toString(),
          chatId: message.chat.id.toString(),
          messageId: message.message_id,
          username: message.from.username,
          firstName: message.from.first_name,
          lastName: message.from.last_name,
          timestamp: new Date(message.date * 1000),
          fileId: undefined,
          fileName: undefined,
          fileSize: undefined,
          mimeType: 'image/jpeg',
          processingInfo: {
            processor: 'photo',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      };
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