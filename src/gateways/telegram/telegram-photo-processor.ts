import type { Context } from 'telegraf';
import type { MessageProcessor } from '../types.js';
import type { ProcessedMessage, FileReference } from '../../types/index.js';
import { PhotoProcessor, type ImageFile, type PhotoResult } from '../../processors/photo.processor.js';
import { TelegramFileDownloader } from './telegram-file-downloader.js';
import { CoreFileProcessorPipeline, type FileProcessorPipeline } from '../../core/file-processor-pipeline.js';

export interface TelegramPhotoProcessorConfig {
  photoProcessor: PhotoProcessor;
  telegramBotToken: string;
}

/**
 * Photo-specific pipeline implementation
 */
class TelegramPhotoPipeline implements FileProcessorPipeline<ImageFile, PhotoResult> {
  constructor(
    private downloader: TelegramFileDownloader,
    private photoProcessor: PhotoProcessor
  ) {}

  async downloadFile(fileId: string, fileName: string, fileSize?: number): Promise<ImageFile> {
    return this.downloader.downloadPhoto(fileId, fileName, fileSize);
  }

  async processFile(file: ImageFile): Promise<PhotoResult> {
    return this.photoProcessor.analyzeImage(file);
  }

  createProcessedMessage(
    result: PhotoResult,
    file: ImageFile,
    fileReference: FileReference,
    gatewayMessageId: string,
    timestamp: Date,
    storedFileId: string,
    originalCaption?: string
  ): ProcessedMessage {
    return {
      content: result.summary || originalCaption || '[Photo analyzed]',
      messageType: 'photo',
      gatewayType: 'telegram',
      gatewayMessageId,
      timestamp,
      fileReference,
      processingMetadata: {
        processor: 'photo',
        fileId: storedFileId,
        contentType: result.contentType,
        summary: result.summary,
        description: result.description,
        extractedText: result.extractedText,
        keyInsights: result.keyInsights,
        confidence: result.confidence,
        originalCaption,
        imageSize: file.size,
        processingTimestamp: new Date().toISOString(),
      },
      processingStatus: 'completed',
    };
  }
}

export class TelegramPhotoProcessor implements MessageProcessor {
  private pipeline: CoreFileProcessorPipeline<ImageFile, PhotoResult>;

  constructor(config: TelegramPhotoProcessorConfig) {
    const downloader = new TelegramFileDownloader(config.telegramBotToken);
    const photoPipeline = new TelegramPhotoPipeline(downloader, config.photoProcessor);
    
    // Create core pipeline with file storage moved to upper hierarchy
    this.pipeline = new CoreFileProcessorPipeline(
      photoPipeline,
      'photo',  // fileType for storage
      'photo',  // messageType for ProcessedMessage
      'telegram' // gatewayType
    );
  }

  async processMessage(ctx: Context): Promise<ProcessedMessage> {
    const message = ctx.message;
    if (!message) {
      throw new Error('No message in context');
    }

    if (!('photo' in message)) {
      throw new Error('Message does not contain a photo');
    }

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
    
    // Use the core pipeline: Download → Store → Process
    return this.pipeline.processFile(
      fileId,
      fileName,
      'image/jpeg',
      message.message_id.toString(),
      new Date(message.date * 1000),
      caption,
      fileSize // Additional arg for photo download
    );
  }
} 