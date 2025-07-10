import type { Context } from 'telegraf';
import type { ProcessedMessage } from '../types.js';

export class TelegramExtractor {
  extractMessage(ctx: Context, messageType: string): ProcessedMessage {
    const message = ctx.message;
    if (!message) {
      throw new Error('No message in context');
    }

    let text = '';
    let fileId: string | undefined;
    let fileName: string | undefined;
    let fileSize: number | undefined;
    let mimeType: string | undefined;

    // Extract information based on message type
    switch (messageType) {
      case 'text':
        if ('text' in message) {
          text = message.text;
        }
        break;

      case 'voice':
        if ('voice' in message) {
          text = '[Voice message - processing not yet implemented]';
          fileId = message.voice.file_id;
          fileSize = message.voice.file_size;
          mimeType = message.voice.mime_type;
        } else if ('audio' in message) {
          text = '[Audio file - processing not yet implemented]';
          fileId = message.audio.file_id;
          fileName = message.audio.file_name;
          fileSize = message.audio.file_size;
          mimeType = message.audio.mime_type;
        }
        break;

      case 'document':
        if ('document' in message) {
          text = `[Document: ${message.document.file_name} - processing not yet implemented]`;
          fileId = message.document.file_id;
          fileName = message.document.file_name;
          fileSize = message.document.file_size;
          mimeType = message.document.mime_type;
        }
        break;

      case 'photo':
        if ('photo' in message && message.photo.length > 0) {
          text = '[Photo - processing not yet implemented]';
          // Get the largest photo
          const largestPhoto = message.photo[message.photo.length - 1];
          if (largestPhoto) {
            fileId = largestPhoto.file_id;
            fileSize = largestPhoto.file_size;
          }
        }
        break;

      default:
        text = '[Unknown message type]';
        messageType = 'unknown';
    }

    return {
      text,
      type: messageType,
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
        fileSize,
        mimeType,
      },
    };
  }
} 