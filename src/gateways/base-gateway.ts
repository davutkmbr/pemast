import type { MessageProcessor } from './types.js';

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
} 