import 'dotenv/config';
import { TelegramGateway, TelegramVoiceProcessor, TelegramPhotoProcessor } from './gateways/index.js';
import { TranscriptProcessor, PhotoProcessor } from './processors/index.js';
import { memoryService } from './services/memory.service.js';

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
  
  // Initialize generic photo processor
  const photoProcessor = new PhotoProcessor({
    openaiApiKey,
  });
  
  // Initialize Telegram-specific voice processor
  const telegramVoiceProcessor = new TelegramVoiceProcessor({
    transcriptProcessor,
    telegramBotToken: telegramToken,
  });
  
  // Initialize Telegram-specific photo processor
  const telegramPhotoProcessor = new TelegramPhotoProcessor({
    photoProcessor,
    telegramBotToken: telegramToken,
  });
  
  // Register processors with the gateway
  telegramGateway.registerProcessor('voice', telegramVoiceProcessor);
  telegramGateway.registerProcessor('photo', telegramPhotoProcessor);
  
  console.log('✅ Voice transcription enabled (OpenAI Whisper)');
  console.log('✅ Photo analysis enabled (GPT-4 Vision)');
  
  // TODO: Register other processors when implemented
  // telegramGateway.registerProcessor('document', new FileProcessor());
  
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
  console.log('🎤 Voice messages: OpenAI Whisper transcription');
  console.log('📸 Photos: GPT-4 Vision analysis (OCR, description, analysis)');
  console.log('📄 Documents: Basic detection (processor pending)');
}

main().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});