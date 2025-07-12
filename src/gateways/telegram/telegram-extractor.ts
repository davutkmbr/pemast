import type { Context } from "telegraf";
import type {
  ProcessedMessage,
  UserContext,
  MessageType,
  FileReference,
} from "../../types/index.js";
import type { MessageExtractor } from "../types.js";

export class TelegramExtractor implements MessageExtractor {
  async extractMessage(ctx: Context, messageType: string): Promise<ProcessedMessage> {
    const message = ctx.message;
    if (!message) {
      throw new Error("No message in context");
    }

    let content = "";
    let fileReference: FileReference | undefined;

    // Extract content based on message type
    switch (messageType) {
      case "text":
        if ("text" in message) {
          content = message.text;
        }
        break;

      case "voice":
        if ("voice" in message) {
          content = "[Voice message - transcription pending]";
          fileReference = {
            id: message.voice.file_id,
            fileName: `voice_${Date.now()}.ogg`,
            mimeType: message.voice.mime_type || "audio/ogg",
            fileSize: message.voice.file_size,
            gateway: "telegram",
          };
        } else if ("audio" in message) {
          content = "[Audio file - transcription pending]";
          fileReference = {
            id: message.audio.file_id,
            fileName: message.audio.file_name || `audio_${Date.now()}.mp3`,
            mimeType: message.audio.mime_type || "audio/mpeg",
            fileSize: message.audio.file_size,
            gateway: "telegram",
          };
        }
        break;

      case "document":
        if ("document" in message) {
          content = `[Document: ${message.document.file_name || "unknown"} - analysis pending]`;
          fileReference = {
            id: message.document.file_id,
            fileName: message.document.file_name || `document_${Date.now()}`,
            mimeType: message.document.mime_type || "application/octet-stream",
            fileSize: message.document.file_size,
            gateway: "telegram",
          };
        }
        break;

      case "photo":
        if ("photo" in message && message.photo.length > 0) {
          content = message.caption || "[Photo - analysis pending]";
          // Get the largest photo (best quality)
          const largestPhoto = message.photo[message.photo.length - 1];
          if (largestPhoto) {
            fileReference = {
              id: largestPhoto.file_id,
              fileName: `photo_${Date.now()}.jpg`,
              mimeType: "image/jpeg",
              fileSize: largestPhoto.file_size,
              gateway: "telegram",
            };
          }
        }
        break;

      default:
        content = "[Unknown message type]";
        messageType = "text"; // Fallback to text type
    }

    return {
      content,
      messageType: messageType as MessageType,
      gatewayType: "telegram",
      gatewayMessageId: message.message_id.toString(),
      timestamp: new Date(message.date * 1000),
      fileReference,
      processingStatus: "completed",
    };
  }

  extractUserContext(ctx: Context): UserContext {
    const message = ctx.message;
    if (!message) {
      throw new Error("No message in context");
    }

    const userContext: UserContext = {
      externalUserId: message.from.id.toString(),
      chatId: message.chat.id.toString(),
    };

    // Add optional fields if they exist
    if (message.from.username) {
      userContext.username = message.from.username;
    }
    if (message.from.first_name) {
      userContext.firstName = message.from.first_name;
    }
    if (message.from.last_name) {
      userContext.lastName = message.from.last_name;
    }

    return userContext;
  }
}
