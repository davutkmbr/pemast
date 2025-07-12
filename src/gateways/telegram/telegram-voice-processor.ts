import type { Context } from 'telegraf';
import type { MessageProcessor } from '../types.js';
import type { ProcessedMessage, FileReference } from '../../types/index.js';
import { TranscriptProcessor, type AudioFile, type TranscriptResult } from '../../processors/transcript.processor.js';
import { TelegramFileDownloader } from './telegram-file-downloader.js';
import { CoreFileProcessorPipeline, type FileProcessorPipeline } from '../../core/file-processor-pipeline.js';

export interface TelegramVoiceProcessorConfig {
  transcriptProcessor: TranscriptProcessor;
  telegramBotToken: string;
}

/**
 * Voice-specific pipeline implementation
 */
class TelegramVoicePipeline implements FileProcessorPipeline<AudioFile, TranscriptResult> {
  constructor(
    private downloader: TelegramFileDownloader,
    private transcriptProcessor: TranscriptProcessor
  ) {}

  async downloadFile(fileId: string, fileName: string, mimeType: string, duration?: number): Promise<AudioFile> {
    return this.downloader.downloadAudio(fileId, fileName, mimeType, duration);
  }

  async processFile(file: AudioFile): Promise<TranscriptResult> {
    return this.transcriptProcessor.transcribeAudio(file);
  }

  createProcessedMessage(
    result: TranscriptResult,
    file: AudioFile,
    fileReference: FileReference,
    gatewayMessageId: string,
    timestamp: Date,
    storedFileId: string,
    originalCaption?: string
  ): ProcessedMessage {
    return {
      content: result.text || '[Voice message - transcription failed]',
      messageType: 'voice',
      gatewayType: 'telegram',
      gatewayMessageId,
      timestamp,
      fileReference,
      processingMetadata: {
        processor: 'transcript',
        fileId: storedFileId,
        duration: result.duration,
        transcriptionLength: result.text.length,
        confidence: result.confidence,
        audioMimeType: file.mimeType,
        processingTimestamp: new Date().toISOString(),
      },
      processingStatus: result.error ? 'failed' : 'completed',
    };
  }
}

export class TelegramVoiceProcessor implements MessageProcessor {
  private pipeline: CoreFileProcessorPipeline<AudioFile, TranscriptResult>;

  constructor(config: TelegramVoiceProcessorConfig) {
    const downloader = new TelegramFileDownloader(config.telegramBotToken);
    const voicePipeline = new TelegramVoicePipeline(downloader, config.transcriptProcessor);
    
    // Create core pipeline with file storage moved to upper hierarchy
    this.pipeline = new CoreFileProcessorPipeline(
      voicePipeline,
      'voice',  // fileType for storage
      'voice',  // messageType for ProcessedMessage
      'telegram' // gatewayType
    );
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

    // Use the core pipeline: Download → Store → Process
    return this.pipeline.processFile(
      fileId,
      fileName,
      mimeType,
      message.message_id.toString(),
      new Date(message.date * 1000),
      undefined, // No caption for voice messages
      mimeType,  // Additional arg for voice download
      duration   // Additional arg for voice download
    );
  }
} 