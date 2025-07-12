import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// === ENUMS ===
export const roleEnum = pgEnum("role", ["owner", "member"]);
export const gatewayTypeEnum = pgEnum("gateway_type", ["telegram", "slack", "discord", "whatsapp"]);
export const messageTypeEnum = pgEnum("message_type", ["text", "voice", "document", "photo"]);
export const fileTypeEnum = pgEnum("file_type", [
  "text",
  "voice",
  "document",
  "photo",
  "video",
  "audio",
]);
export const processingStatusEnum = pgEnum("processing_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
export const recurrenceTypeEnum = pgEnum("recurrence_type", [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

// === CORE TABLES ===
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalId: text("external_id"), // Gateway-specific user ID
  displayName: text("display_name"),
  email: text("email"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").default("member"),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.userId] }),
  }),
);

export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  gatewayType: gatewayTypeEnum("gateway_type").notNull(),
  externalChatId: text("external_chat_id").notNull(), // Gateway-specific chat ID
  name: text("name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// === FILES TABLE (Normalized) ===
export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  originalName: text("original_name").notNull(),
  storagePath: text("storage_path"), // Supabase Storage path
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"),
  fileType: fileTypeEnum("file_type").notNull(),
  gatewayFileId: text("gateway_file_id"), // Original platform file ID
  gatewayType: gatewayTypeEnum("gateway_type"),
  checksum: text("checksum"), // For deduplication
  isProcessed: boolean("is_processed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// === MESSAGES TABLE (Core conversation data) ===
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }),

  // Role in the conversation (user / assistant)
  role: messageRoleEnum("role").default("user"),

  // Message content
  messageType: messageTypeEnum("message_type").notNull(),
  content: text("content").notNull(), // Main text content

  // Gateway-specific data
  gatewayType: gatewayTypeEnum("gateway_type").notNull(),
  gatewayMessageId: text("gateway_message_id").notNull(), // Platform-specific message ID

  // File attachment (optional)
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),

  // Processing metadata (flexible JSON)
  processingMetadata: jsonb("processing_metadata").$type<{
    processor?: string;
    duration?: number;
    confidence?: number;
    error?: string;
    extractedText?: string;
    keyInsights?: string[];
    contentType?: string;
    [key: string]: any;
  }>(),

  // Status tracking
  processingStatus: processingStatusEnum("processing_status").default("completed"),

  // Thread/reply support
  parentMessageId: uuid("parent_message_id"), // Self-reference to messages.id
  threadId: uuid("thread_id"), // For grouping related messages

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === DATA TABLES ===
export const reminders = pgTable("reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }), // Source message
  content: text("content").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),

  // Semantic search support
  embedding: vector("embedding", { dimensions: 1536 }), // For semantic search
  tags: text("tags").array(), // For categorization ["birthday", "friend", "fettah"]
  summary: text("summary"), // Brief description for better search

  // Recurrence support
  recurrenceType: recurrenceTypeEnum("recurrence_type").default("none"),
  recurrenceInterval: integer("recurrence_interval").default(1), // Every N intervals (e.g., every 2 weeks)
  recurrenceEndDate: timestamp("recurrence_end_date"), // When to stop creating recurring instances
  isRecurring: boolean("is_recurring").default(false),

  // Status tracking
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memories = pgTable("memories", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }), // Source message

  // Content data
  content: text("content").notNull(),
  summary: text("summary"),
  embedding: vector("embedding", { dimensions: 1536 }),

  // File reference
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),

  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  tags: text("tags").array(), // For categorization

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

  // Preference key-value pairs
  key: text("key").notNull(),
  value: text("value").notNull(),

  // Optional metadata for complex preferences
  metadata: jsonb("metadata").$type<Record<string, any>>(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === RELATIONS ===
export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(projectMembers),
  channels: many(channels),
  messages: many(messages),
  reminders: many(reminders),
  memories: many(memories),
  userPreferences: many(userPreferences),
}));

export const usersRelations = relations(users, ({ many }) => ({
  projectMemberships: many(projectMembers),
  messages: many(messages),
  reminders: many(reminders),
  memories: many(memories),
  userPreferences: many(userPreferences),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  project: one(projects, { fields: [messages.projectId], references: [projects.id] }),
  user: one(users, { fields: [messages.userId], references: [users.id] }),
  channel: one(channels, { fields: [messages.channelId], references: [channels.id] }),
  file: one(files, { fields: [messages.fileId], references: [files.id] }),
  // Note: Self-referencing relations for parentMessage/replies can be added later if needed
  // They work at the database level but can cause TypeScript circular reference issues
  reminders: many(reminders),
  memories: many(memories),
}));

export const filesRelations = relations(files, ({ many }) => ({
  messages: many(messages),
  memories: many(memories),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  project: one(projects, { fields: [channels.projectId], references: [projects.id] }),
  messages: many(messages),
}));

export const memoriesRelations = relations(memories, ({ one }) => ({
  project: one(projects, { fields: [memories.projectId], references: [projects.id] }),
  user: one(users, { fields: [memories.userId], references: [users.id] }),
  message: one(messages, { fields: [memories.messageId], references: [messages.id] }),
  file: one(files, { fields: [memories.fileId], references: [files.id] }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  project: one(projects, { fields: [userPreferences.projectId], references: [projects.id] }),
  user: one(users, { fields: [userPreferences.userId], references: [users.id] }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  project: one(projects, { fields: [reminders.projectId], references: [projects.id] }),
  user: one(users, { fields: [reminders.userId], references: [users.id] }),
  message: one(messages, { fields: [reminders.messageId], references: [messages.id] }),
  // Note: Self-referencing relation for parentReminder can be added later if needed
  // It works at the database level but can cause TypeScript circular reference issues
}));
