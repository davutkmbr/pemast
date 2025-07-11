import type { Context } from 'telegraf';
import type { MessageProcessor } from '../types.js';
import type { ProcessedMessage, FileReference } from '../../types/index.js';
import { TranscriptProcessor, type AudioFile } from '../../processors/transcript.processor.js';

export interface TelegramVoiceProcessorConfig {
  transcriptProcessor: TranscriptProcessor;
  telegramBotToken: string;
}

export class TelegramVoiceProcessor implements MessageProcessor {
  private transcriptProcessor: TranscriptProcessor;
  private telegramBotToken: string;

  constructor(config: TelegramVoiceProcessorConfig) {
    this.transcriptProcessor = config.transcriptProcessor;
    this.telegramBotToken = config.telegramBotToken;
  }

  async processMessage(ctx: Context): Promise<ProcessedMessage> {
    const message = ctx.message;
    if (!message) {
      throw new Error('No message in context');
    }

    let fileId: string;
    let fileName: string;
    let duration: number | undefined;
    let mimeType: string;

    // Extract file information based on message type
    if ('voice' in message) {
      fileId = message.voice.file_id;
      fileName = `voice_${Date.now()}.ogg`;
      duration = message.voice.duration;
      mimeType = message.voice.mime_type || 'audio/ogg';
    } else if ('audio' in message) {
      fileId = message.audio.file_id;
      fileName = message.audio.file_name || `audio_${Date.now()}.mp3`;
      duration = message.audio.duration;
      mimeType = message.audio.mime_type || 'audio/mpeg';
    } else {
      throw new Error('Message does not contain voice or audio');
    }

    try {
      // Download the audio file from Telegram
      const audioFile = await this.downloadTelegramAudio(fileId, fileName, mimeType, duration);
      
      // Transcribe using the generic processor
      const transcriptResult = await this.transcriptProcessor.transcribeAudio(audioFile);
      
      // Create file reference
      const fileReference: FileReference = {
        id: fileId,
        fileName,
        mimeType,
        gateway: 'telegram',
      };

      // Return modern ProcessedMessage with transcription
      return {
        content: transcriptResult.text || '[Voice message - transcription failed]',
        messageType: 'voice',
        gatewayType: 'telegram',
        gatewayMessageId: message.message_id.toString(),
        timestamp: new Date(message.date * 1000),
        fileReference,
        processingMetadata: {
          processor: 'transcript',
          duration: transcriptResult.duration,
          transcriptionLength: transcriptResult.text.length,
          confidence: transcriptResult.confidence,
        },
        processingStatus: transcriptResult.error ? 'failed' : 'completed',
      };
      
    } catch (error) {
      console.error('Error processing voice message:', error);
      
      // Return fallback message on processing failure
      const fileReference: FileReference = {
        id: fileId,
        fileName,
        mimeType,
        gateway: 'telegram',
      };

      return {
        content: '[Voice message - processing failed]',
        messageType: 'voice',
        gatewayType: 'telegram',
        gatewayMessageId: message.message_id.toString(),
        timestamp: new Date(message.date * 1000),
        fileReference,
        processingMetadata: {
          processor: 'transcript',
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        processingStatus: 'failed',
      };
    }
  }

  private async downloadTelegramAudio(
    fileId: string,
    fileName: string,
    mimeType: string,
    duration?: number
  ): Promise<AudioFile> {
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
      const audioResponse = await fetch(
        `https://api.telegram.org/file/bot${this.telegramBotToken}/${fileData.result.file_path}`
      );
      
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio file: ${audioResponse.statusText}`);
      }
      
      const audioBuffer = await audioResponse.arrayBuffer();
      
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
} 