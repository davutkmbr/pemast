import type { Context } from 'telegraf';
import type { ProcessedMessage, UserContext } from '../types/index.js';

/**
 * Modern message processor interface
 * Processors directly create ProcessedMessage in the new format
 */
export interface MessageProcessor {
  processMessage(ctx: Context): Promise<ProcessedMessage>;
}

/**
 * Gateway message extractor interface
 * For basic message extraction when no specialized processor is available
 */
export interface MessageExtractor {
  extractMessage(ctx: Context, messageType: string): Promise<ProcessedMessage>;
  extractUserContext(ctx: Context): UserContext;
} 