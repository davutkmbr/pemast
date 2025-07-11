// Example usage of ReminderService
import { ReminderService } from './reminder.service.js';
import type { CreateReminderInput, DatabaseContext } from '../types/index.js';

async function exampleUsage() {
  const reminderService = new ReminderService();
  
  // Database context (would come from user/message context)
  const context: DatabaseContext = {
    projectId: 'project-123',
    userId: 'user-456', 
    channelId: 'channel-789'
  };

  // Example 1: One-time reminder
  const oneTimeReminder: CreateReminderInput = {
    content: 'Dentist appointment',
    scheduledFor: new Date('2024-01-15 14:30:00'),
    messageId: 'msg-1'
  };

  const oneTimeId = await reminderService.createReminder(oneTimeReminder, context);
  console.log('Created one-time reminder:', oneTimeId);

  // Example 2: Daily recurring reminder
  const dailyReminder: CreateReminderInput = {
    content: 'Take vitamins',
    scheduledFor: new Date('2024-01-01 09:00:00'),
    messageId: 'msg-2',
    recurrence: {
      type: 'daily',
      interval: 1, // Every day
      endDate: new Date('2024-12-31') // Until end of year
    }
  };

  const dailyId = await reminderService.createReminder(dailyReminder, context);
  console.log('Created daily reminder:', dailyId);

  // Example 3: Weekly recurring reminder (every 2 weeks)
  const biweeklyReminder: CreateReminderInput = {
    content: 'Team retrospective meeting',
    scheduledFor: new Date('2024-01-08 10:00:00'), // Monday
    messageId: 'msg-3',
    recurrence: {
      type: 'weekly',
      interval: 2, // Every 2 weeks
      // No end date = infinite
    }
  };

  const biweeklyId = await reminderService.createReminder(biweeklyReminder, context);
  console.log('Created bi-weekly reminder:', biweeklyId);

  // Example 4: Monthly recurring reminder
  const monthlyReminder: CreateReminderInput = {
    content: 'Pay rent',
    scheduledFor: new Date('2024-01-01 10:00:00'), // 1st of month
    messageId: 'msg-4',
    recurrence: {
      type: 'monthly',
      interval: 1 // Every month
    }
  };

  const monthlyId = await reminderService.createReminder(monthlyReminder, context);
  console.log('Created monthly reminder:', monthlyId);

  // SEMANTIC SEARCH EXAMPLES - User's Fettah scenario

  // Example 5: Birthday reminder with semantic tags
  const fettahBirthdayReminder: CreateReminderInput = {
    content: "Fettah'ın doğum günü - tebrik et!",
    scheduledFor: new Date('2024-05-28 09:00:00'), // May 28th
    messageId: 'msg-5',
    summary: "Arkadaşım Fettah'ın doğum günü hatırlatıcısı",
    tags: ['fettah', 'arkadaş', 'doğum günü', 'birthday', 'friend'],
    recurrence: {
      type: 'yearly',
      interval: 1 // Every year
    }
  };

  const fettahId = await reminderService.createReminder(fettahBirthdayReminder, context);
  console.log('Created Fettah birthday reminder:', fettahId);

  // Example search scenarios - how to find the Fettah reminder later
  
  // Scenario 1: "Fettah'ın doğum günüyle ilgili hatırlatıcıyı sil"
  const fettahSearch1 = await reminderService.findReminders(
    "Fettah doğum günü",
    context.userId,
    context.projectId
  );
  console.log('Found reminders for "Fettah doğum günü":', fettahSearch1.combined);

  // Scenario 2: "Arkadaşımın birthday reminder'ını iptal et"
  const fettahSearch2 = await reminderService.findReminders(
    "arkadaş birthday",
    context.userId,
    context.projectId
  );
  console.log('Found reminders for "arkadaş birthday":', fettahSearch2.combined);

  // Scenario 3: Tag-based search
  const tagSearch = await reminderService.searchRemindersByTags(
    ['fettah', 'doğum günü'],
    context.userId,
    context.projectId
  );
  console.log('Found reminders by tags [fettah, doğum günü]:', tagSearch);

  // Scenario 4: Text-based search
  const textSearch = await reminderService.searchRemindersByText(
    "Fettah",
    context.userId,
    context.projectId
  );
  console.log('Found reminders by text "Fettah":', textSearch);

  // Get upcoming reminders
  const upcoming = await reminderService.getUpcomingReminders(
    context.userId, 
    context.projectId, 
    5
  );
  console.log('Upcoming reminders:', upcoming);

  // Cancel a reminder
  await reminderService.cancelReminder(oneTimeId);
  console.log('Cancelled one-time reminder');

  // Process due reminders (this would be called by cron job)
  const results = await reminderService.processAllDueReminders();
  console.log('Cron job results:', results);
}

// Example: How AI/LLM would use semantic search
async function aiSearchExample() {
  const reminderService = new ReminderService();
  const userId = 'user-456';
  const projectId = 'project-123';

  // User says: "Fettah'la ilgili o hatırlatıcıyı siler misin?"
  const userQuery = "Fettah hatırlatıcı";
  
  const searchResults = await reminderService.findReminders(
    userQuery,
    userId,
    projectId,
    {
      limit: 3,
      searchMethods: ['semantic', 'text', 'tags']
    }
  );

  console.log('AI Search Results:', {
    query: userQuery,
    found: searchResults.combined.length,
    reminders: searchResults.combined.map(r => ({
      id: r.id,
      content: r.content,
      summary: r.summary,
      tags: r.tags,
      scheduledFor: r.scheduledFor
    }))
  });

  // AI can now present options to user:
  // "Bulduğum hatırlatıcılar:
  // 1. Fettah'ın doğum günü - tebrik et! (28 Mayıs 2024)
  // Hangisini silmek istiyorsun?"
}

// Example cron job results:
/*
{
  processed: 5,
  completed: 2,    // One-time reminders completed
  rescheduled: 3,  // Recurring reminders moved to next occurrence  
  ended: 0,        // Recurring reminders that reached end date
  errors: []       // Any processing errors
}
*/

// How recurring reminders work:
/*
1. User says: "Remind me to take medicine every day at 9am"
2. Reminder created:
   - scheduledFor: "2024-01-01 09:00:00"
   - recurrenceType: "daily"
   - isRecurring: true

3. Cron job runs every minute:
   - Finds reminders where scheduledFor <= now
   - Sends notification to user
   - Updates scheduledFor to "2024-01-02 09:00:00"
   - Reminder continues indefinitely

4. If user says "stop daily medicine reminder":
   - We find all reminders for that messageId
   - Mark them as completed
*/

// Semantic Search Flow:
/*
1. User: "Fettah benim arkadaşım. onu çok severim, doğum günü 28 mayıs."
2. AI creates:
   - Memory: "Fettah is my friend, born May 28th"
   - Reminder: {
       content: "Fettah'ın doğum günü",
       tags: ["fettah", "arkadaş", "doğum günü"],
       summary: "Arkadaşım Fettah'ın doğum günü hatırlatıcısı",
       scheduledFor: "2024-05-28",
       recurrence: { type: "yearly" }
     }

3. Later user: "Fettah'ın doğum günüyle ilgili hatırlatıcıyı sil"
4. AI searches:
   - Semantic: "Fettah doğum günü" -> high similarity match
   - Text: "Fettah" -> direct content match  
   - Tags: ["fettah", "doğum", "günü"] -> tag overlap
5. AI finds the reminder and can delete it
*/

export { exampleUsage, aiSearchExample }; 