import type { AudioFile } from '../../processors/transcript.processor.js';
import type { ImageFile } from '../../processors/photo.processor.js';

/**
 * Reusable Telegram file downloader utility
 * Eliminates duplication between voice and photo processors
 */
export class TelegramFileDownloader {
  constructor(private telegramBotToken: string) {}

  /**
   * Download a photo from Telegram
   */
  async downloadPhoto(
    fileId: string,
    fileName: string,
    fileSize?: number
  ): Promise<ImageFile> {
    try {
      const fileData = await this.getTelegramFile(fileId);
      const photoBuffer = await this.downloadFile(fileData.file_path);
      
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

  /**
   * Download an audio file from Telegram
   */
  async downloadAudio(
    fileId: string,
    fileName: string,
    mimeType: string,
    duration?: number
  ): Promise<AudioFile> {
    try {
      const fileData = await this.getTelegramFile(fileId);
      const audioBuffer = await this.downloadFile(fileData.file_path);
      
      return {
        buffer: audioBuffer,
        fileName,
        mimeType,
        duration,
      };
    } catch (error) {
      console.error('Error downloading Telegram audio:', error);
      throw error;
    }
  }

  /**
   * Get file info from Telegram API
   */
  private async getTelegramFile(fileId: string): Promise<{ file_path: string }> {
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
    
    return fileData.result;
  }

  /**
   * Download file content from Telegram
   */
  private async downloadFile(filePath: string): Promise<ArrayBuffer> {
    const fileResponse = await fetch(
      `https://api.telegram.org/file/bot${this.telegramBotToken}/${filePath}`
    );
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }
    
    return await fileResponse.arrayBuffer();
  }
} 