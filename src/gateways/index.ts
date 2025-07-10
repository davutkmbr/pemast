// Base gateway interface
export { BaseGateway, type GatewayConfig } from './base-gateway.js';

// Platform-specific gateways
export { TelegramGateway, TelegramVoiceProcessor, type TelegramVoiceProcessorConfig } from './telegram/index.js';

// Shared types and utilities
export type { ProcessedMessage, MessageProcessor } from './types.js';
export { MessageRouter } from './message-router.js';
export { ResponseFormatter } from './response-formatter.js'; 