import 'dotenv/config';
import { TelegramGateway, TelegramVoiceProcessor } from './gateways/index.js';
import { TranscriptProcessor } from './processors/index.js';

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

  console.log('Starting personal assistant...');
  
  // Initialize Telegram gateway
  const telegramGateway = new TelegramGateway({ token: telegramToken });
  
  // Initialize generic transcript processor
  const transcriptProcessor = new TranscriptProcessor({
    openaiApiKey,
  });
  
  // Initialize Telegram-specific voice processor
  const telegramVoiceProcessor = new TelegramVoiceProcessor({
    transcriptProcessor,
    telegramBotToken: telegramToken,
  });
  
  // Register the platform-specific voice processor
  telegramGateway.registerProcessor('voice', telegramVoiceProcessor);
  console.log('✅ Voice transcription enabled (Telegram → Generic Processor)');
  
  // TODO: Register other processors when implemented
  // telegramGateway.registerProcessor('document', new FileProcessor());
  // telegramGateway.registerProcessor('photo', new PhotoProcessor());
  
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
  console.log(`🚀 Personal assistant ready! Gateway: ${telegramGateway.getGatewayType()}`);
  console.log('📝 Text messages: Direct processing');
  console.log('🎤 Voice messages: OpenAI Whisper transcription (modular)');
  console.log('📄 Documents: Basic detection (processor pending)');
  console.log('📸 Photos: Basic detection (processor pending)');
}

main().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});