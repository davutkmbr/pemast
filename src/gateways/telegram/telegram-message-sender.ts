import { Input, Telegraf } from "telegraf";
import {
  type FileSendOptions,
  MessageSender,
  type MessageSendOptions,
  type MessageSendResult,
} from "../message-sender.js";

/**
 * Telegram implementation of MessageSender
 * Sends messages directly using Telegram Bot API without requiring Context
 */
export class TelegramMessageSender extends MessageSender {
  private bot: Telegraf;

  constructor(botToken: string) {
    super();
    this.bot = new Telegraf(botToken);
  }

  async sendMessage(
    chatId: string,
    message: string,
    options?: MessageSendOptions,
  ): Promise<MessageSendResult> {
    try {
      const sendOptions: any = {};

      if (options?.parseMode) {
        sendOptions.parse_mode = options.parseMode;
      }

      const result = await this.bot.telegram.sendMessage(chatId, message, sendOptions);

      return {
        success: true,
        messageId: result.message_id.toString(),
      };
    } catch (error) {
      console.error("Error sending Telegram message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendPhoto(
    chatId: string,
    photoBuffer: Buffer,
    options?: FileSendOptions,
  ): Promise<MessageSendResult> {
    try {
      const fileName = options?.fileName || "photo.jpg";
      const inputFile = Input.fromBuffer(photoBuffer, fileName);

      const sendOptions: any = {};
      if (options?.caption) {
        sendOptions.caption = options.caption;
      }
      if (options?.parseMode) {
        sendOptions.parse_mode = options.parseMode;
      }

      const result = await this.bot.telegram.sendPhoto(chatId, inputFile, sendOptions);

      return {
        success: true,
        messageId: result.message_id.toString(),
      };
    } catch (error) {
      console.error("Error sending Telegram photo:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendAudio(
    chatId: string,
    audioBuffer: Buffer,
    options?: FileSendOptions,
  ): Promise<MessageSendResult> {
    try {
      const fileName = options?.fileName || "audio.mp3";
      const inputFile = Input.fromBuffer(audioBuffer, fileName);

      const sendOptions: any = {};
      if (options?.caption) {
        sendOptions.caption = options.caption;
      }
      if (options?.parseMode) {
        sendOptions.parse_mode = options.parseMode;
      }

      const result = await this.bot.telegram.sendAudio(chatId, inputFile, sendOptions);

      return {
        success: true,
        messageId: result.message_id.toString(),
      };
    } catch (error) {
      console.error("Error sending Telegram audio:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendDocument(
    chatId: string,
    documentBuffer: Buffer,
    options?: FileSendOptions,
  ): Promise<MessageSendResult> {
    try {
      const fileName = options?.fileName || "document.pdf";
      const inputFile = Input.fromBuffer(documentBuffer, fileName);

      const sendOptions: any = {};
      if (options?.caption) {
        sendOptions.caption = options.caption;
      }
      if (options?.parseMode) {
        sendOptions.parse_mode = options.parseMode;
      }

      const result = await this.bot.telegram.sendDocument(chatId, inputFile, sendOptions);

      return {
        success: true,
        messageId: result.message_id.toString(),
      };
    } catch (error) {
      console.error("Error sending Telegram document:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendVoice(
    chatId: string,
    voiceBuffer: Buffer,
    options?: MessageSendOptions,
  ): Promise<MessageSendResult> {
    try {
      const inputFile = Input.fromBuffer(voiceBuffer, "voice.ogg");

      const sendOptions: any = {};
      if (options?.caption) {
        sendOptions.caption = options.caption;
      }
      if (options?.parseMode) {
        sendOptions.parse_mode = options.parseMode;
      }

      const result = await this.bot.telegram.sendVoice(chatId, inputFile, sendOptions);

      return {
        success: true,
        messageId: result.message_id.toString(),
      };
    } catch (error) {
      console.error("Error sending Telegram voice:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getGatewayType(): string {
    return "telegram";
  }
}
