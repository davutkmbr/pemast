import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Database connection
const connectionString =
  process.env.DATABASE_URL || process.env.SUPABASE_URL?.replace("https://", "postgresql://");

if (!connectionString) {
  throw new Error("DATABASE_URL or SUPABASE_URL environment variable is required");
}

// Create postgres client
const client = postgres(connectionString, {
  prepare: false, // Disable prepared statements for Supabase
});

// Create Drizzle database instance
export const db = drizzle(client, { schema });

// === TYPE EXPORTS ===
// Base table types
export type Project = typeof schema.projects.$inferSelect;
export type NewProject = typeof schema.projects.$inferInsert;

export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;

export type Channel = typeof schema.channels.$inferSelect;
export type NewChannel = typeof schema.channels.$inferInsert;

export type File = typeof schema.files.$inferSelect;
export type NewFile = typeof schema.files.$inferInsert;

export type Message = typeof schema.messages.$inferSelect;
export type NewMessage = typeof schema.messages.$inferInsert;

export type Memory = typeof schema.memories.$inferSelect;
export type NewMemory = typeof schema.memories.$inferInsert;

export type UserPreference = typeof schema.userPreferences.$inferSelect;
export type NewUserPreference = typeof schema.userPreferences.$inferInsert;

export type Reminder = typeof schema.reminders.$inferSelect;
export type NewReminder = typeof schema.reminders.$inferInsert;

// Enum types
export type GatewayType = (typeof schema.gatewayTypeEnum.enumValues)[number];
export type MessageType = (typeof schema.messageTypeEnum.enumValues)[number];
export type FileType = (typeof schema.fileTypeEnum.enumValues)[number];
export type ProcessingStatus = (typeof schema.processingStatusEnum.enumValues)[number];
export type Role = (typeof schema.roleEnum.enumValues)[number];
export type RecurrenceType = (typeof schema.recurrenceTypeEnum.enumValues)[number];

// Complex types for processing metadata
export type ProcessingMetadata = {
  processor?: string;
  duration?: number;
  confidence?: number;
  error?: string;
  extractedText?: string;
  keyInsights?: string[];
  contentType?: string;
  [key: string]: any;
};

// Helper types for queries
export type MessageWithRelations = Message & {
  user?: User;
  channel?: Channel;
  file?: File;
  project?: Project;
};

export type MemoryWithRelations = Memory & {
  user?: User;
  message?: Message;
  file?: File;
  project?: Project;
};

// === UTILITY FUNCTIONS ===
/**
 * Close database connection
 */
export async function closeConnection() {
  await client.end();
}

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    await client`SELECT 1`;
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}
