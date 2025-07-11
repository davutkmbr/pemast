// Supabase Edge Function for processing due reminders
// This should be deployed to Supabase and triggered by pg_cron every minute

// @ts-ignore - This runs in Deno runtime (Supabase Edge Functions)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { ReminderService } from '../services/reminder.service.js';

// Edge Function handler
export default async function handler(req: Request): Promise<Response> {
  // Only allow POST requests from cron
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Optional: Add authentication/authorization here
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log('🕐 Starting due reminders processing...');
    
    const reminderService = new ReminderService();
    const results = await reminderService.processAllDueReminders();
    
    console.log('✅ Due reminders processing completed:', results);
    
    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error processing due reminders:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// pg_cron setup (run this SQL in Supabase):
/*
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the reminder processing to run every minute
SELECT cron.schedule(
  'process-due-reminders',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/process-due-reminders',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET", "Content-Type": "application/json"}',
    body := '{}'::jsonb
  );
  $$
);

-- Check cron jobs
SELECT * FROM cron.job;

-- Remove job if needed
-- SELECT cron.unschedule('process-due-reminders');
*/ 