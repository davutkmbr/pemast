import 'dotenv/config';
import { TelegramGateway, TelegramVoiceProcessor, TelegramPhotoProcessor } from './gateways/index.js';
import { TranscriptProcessor, PhotoProcessor } from './processors/index.js';

async function main() {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!telegramToken) {
    console.error('TELEGRAM_BOT_TOKEN is required in environment variables');
    process.exit(1);
  }

  if (!openaiApiKey) {
    console.error('OPENAI_API_KEY is required in environment variables');
    process.exit(1);
  }

  console.log('Starting personal assistant with refactored architecture...');
  
  // Initialize Telegram gateway V2 with dependency injection
  const telegramGateway = new TelegramGateway({ token: telegramToken });
  
  // Initialize generic processors
  const transcriptProcessor = new TranscriptProcessor({
    openaiApiKey,
  });
  
  const photoProcessor = new PhotoProcessor({
    openaiApiKey,
  });
  
  // Initialize Telegram-specific processors
  const telegramVoiceProcessor = new TelegramVoiceProcessor({
    transcriptProcessor,
    telegramBotToken: telegramToken,
  });
  
  const telegramPhotoProcessor = new TelegramPhotoProcessor({
    photoProcessor,
    telegramBotToken: telegramToken,
  });
  
  // Register processors with the gateway
  telegramGateway.registerProcessor('voice', telegramVoiceProcessor);
  telegramGateway.registerProcessor('photo', telegramPhotoProcessor);
  
  console.log('✅ Voice transcription enabled (OpenAI Whisper)');
  console.log('✅ Photo analysis enabled (GPT-4 Vision)');
  console.log('✅ Clean architecture with dependency injection');
  
  // Start the gateway
  telegramGateway.start();
  
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
}

main().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});