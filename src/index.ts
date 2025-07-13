import "dotenv/config";
import cron from "node-cron";
import {
  TelegramGateway,
  TelegramPhotoProcessor,
  TelegramVoiceProcessor,
} from "./gateways/index.js";
import { PhotoProcessor, TranscriptProcessor } from "./processors/index.js";
import { reminderService } from "./services/reminder.service.js";

// Cron job to process due reminders every minute
cron.schedule("* * * * *", async () => {
  try {
    console.log("🕐 Starting scheduled reminder processing...");
    const results = await reminderService.processAllDueReminders();

    console.log("✅ Scheduled reminder processing completed:", {
      totalProcessed: results.processed,
      completed: results.completed,
      rescheduled: results.rescheduled,
      ended: results.ended,
      notificationsSent: results.notificationsSent,
      notificationsFailed: results.notificationsFailed,
      errors: results.errors.length,
    });
  } catch (error) {
    console.error("❌ Error in scheduled reminder processing:", error);
  }
});

async function main() {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!telegramToken) {
    console.error("TELEGRAM_BOT_TOKEN is required in environment variables");
    process.exit(1);
  }

  if (!openaiApiKey) {
    console.error("OPENAI_API_KEY is required in environment variables");
    process.exit(1);
  }

  console.log("Starting personal assistant with refactored architecture...");
  console.log("🕐 Reminder processing cron job is active (every minute)");

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
  telegramGateway.registerProcessor("voice", telegramVoiceProcessor);
  telegramGateway.registerProcessor("photo", telegramPhotoProcessor);

  console.log("✅ Voice transcription enabled (OpenAI Whisper)");
  console.log("✅ Photo analysis enabled (GPT-4 Vision)");
  console.log("✅ Clean architecture with dependency injection");

  // Start the gateway
  telegramGateway.start();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("Received SIGINT, shutting down gracefully...");
    telegramGateway.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("Received SIGTERM, shutting down gracefully...");
    telegramGateway.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
