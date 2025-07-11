import type { MessageProcessor } from './types.js';
import type { Context } from 'telegraf';

export interface GatewayConfig {
  token: string;
  [key: string]: any; // Allow platform-specific config
}

export abstract class BaseGateway {
  protected config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  // Platform-specific implementation required
  abstract start(): void;
  abstract stop(): void;
  abstract registerProcessor(type: string, processor: MessageProcessor): void;

  // Common gateway info
  abstract getGatewayType(): string;
  abstract getStatus(): 'starting' | 'running' | 'stopping' | 'stopped';
  
  /**
   * Send a message to the gateway
   */
  abstract sendMessage(ctx: Context, message: string): Promise<void>;
} 