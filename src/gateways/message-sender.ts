export interface MessageSendOptions {
  caption?: string;
  parseMode?: "Markdown" | "HTML";
}

export interface FileSendOptions extends MessageSendOptions {
  fileName?: string;
}

export interface MessageSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Abstract interface for one-way message sending through gateways
 * This is separate from the main gateway interface to support
 * notification/reminder systems that don't have a conversation context
 */
export abstract class MessageSender {
  /**
   * Send a text message to a chat/channel
   */
  abstract sendMessage(
    chatId: string,
    message: string,
    options?: MessageSendOptions,
  ): Promise<MessageSendResult>;

  /**
   * Send a photo/image
   */
  abstract sendPhoto(
    chatId: string,
    photoBuffer: Buffer,
    options?: FileSendOptions,
  ): Promise<MessageSendResult>;

  /**
   * Send an audio file
   */
  abstract sendAudio(
    chatId: string,
    audioBuffer: Buffer,
    options?: FileSendOptions,
  ): Promise<MessageSendResult>;

  /**
   * Send a document/file
   */
  abstract sendDocument(
    chatId: string,
    documentBuffer: Buffer,
    options?: FileSendOptions,
  ): Promise<MessageSendResult>;

  /**
   * Send a voice message
   */
  abstract sendVoice(
    chatId: string,
    voiceBuffer: Buffer,
    options?: MessageSendOptions,
  ): Promise<MessageSendResult>;

  /**
   * Get the gateway type
   */
  abstract getGatewayType(): string;
}
