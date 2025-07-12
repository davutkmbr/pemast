// Gateway exports

export type { FileProcessorPipeline } from "../core/file-processor-pipeline.js";
export type { MessagePipeline, ReplyGenerator, StreamingUI } from "../core/message-pipeline.js";
export {
  BaseGateway,
  type FileData,
  type FileSendOptions,
  type FileType,
  type GatewayConfig,
} from "./base-gateway.js";
export { TelegramExtractor } from "./telegram/telegram-extractor.js";
export { TelegramFileDownloader } from "./telegram/telegram-file-downloader.js";
export { TelegramGateway } from "./telegram/telegram-gateway.js";
export { TelegramPhotoProcessor } from "./telegram/telegram-photo-processor.js";
export { TelegramStreamingUI } from "./telegram/telegram-streaming-ui.js";
// Telegram-specific exports
export { TelegramVoiceProcessor } from "./telegram/telegram-voice-processor.js";
// Types
export type { MessageExtractor, MessageProcessor } from "./types.js";
