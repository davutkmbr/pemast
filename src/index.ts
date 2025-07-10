import 'dotenv/config';
import { TelegramGateway } from './gateways/telegram.js';

async function main() {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!telegramToken) {
    console.error('TELEGRAM_BOT_TOKEN is required in environment variables');
    process.exit(1);
  }

  console.log('Starting Telegram bot...');
  
  const telegramGateway = new TelegramGateway(telegramToken);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    telegramGateway.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    telegramGateway.stop();
    process.exit(0);
  });

  telegramGateway.start();
}

main().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});