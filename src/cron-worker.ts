import "dotenv/config";
import cron from "node-cron";
import { reminderService } from "./services/reminder.service.js";

console.log("🕐 Starting Cron Worker for reminder processing...");

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

// Keep the process alive
process.on("SIGINT", () => {
  console.log("Cron worker received SIGINT, shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Cron worker received SIGTERM, shutting down...");
  process.exit(0);
});

console.log("✅ Cron worker is running and will process reminders every minute");
