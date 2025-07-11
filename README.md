# 📖 README — mnemo-assistant-agent

A channel-agnostic personal assistant that **remembers, searches, and reminds** using natural language only.
Built with **Node 18 + TypeScript**, **OpenAI Agents SDK**, and **Supabase** (PostgreSQL + pgvector + Storage + Cron).

---

## 0 · Key Features

| Capability                                  | Example utterance                                                       | Behaviour                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Natural-language reminders**              | "Remind me to service the bike in three weeks."                         | Creates a scheduled job; pushes a message at due time.                            |
| **Episodic memory (files / long texts)**    | "Save this 500-line Java snippet for later."                            | Stores the file in Supabase Storage, saves an embedding of a short summary.       |
| **Semantic facts (single source of truth)** | "My favourite food is pizza." → (two days later) "Actually it's sushi." | Upserts one `facts` row per key via Top-5 vector search + LLM re-rank.            |
| **Multi-media processing**                  | Voice messages, documents, photos                                        | Transcripts, summarizes, and stores with semantic search capabilities.            |
| **Multi-project**                           | Personal project and team workspace share code but keep data separate.  | Row-Level Security isolates each `project_id`.                                    |
| **Multi-channel**                           | Telegram today, Slack/Discord tomorrow.                                 | Gateway modules know how to post/receive, rest of the system is channel-agnostic. |

---

## 1 · Tech Stack

| Layer                    | Package                 | Responsibility                                      |
| ------------------------ | ----------------------- | --------------------------------------------------- |
| **Gateway**              | `telegraf`              | Modern Telegram bot framework with built-in middleware. |
| **Agent runtime**        | `@openai/agents`        | Main conversational agent, decides which tools to call. |
| **Transcript processor** | `@openai/openai` (Whisper) | Converts voice messages to text before agent processing. |
| **File processor**       | `@openai/openai` + custom | Analyzes and summarizes documents, images, and files. |
| **Database ORM**         | `drizzle-orm` + `postgres` | Type-safe database operations with PostgreSQL + pgvector. |
| **Database**             | Supabase Free Tier      | PostgreSQL 15 + pgvector + pg\_cron + Storage.      |
| **Tests / CI**           | `vitest`, `happydom`    | Fast unit & integration tests.                      |
| **Task runner**          | `pnpm`                  | Uniform scripts (`dev`, `test`, `deploy`).          |

---

## 2 · OpenAI API Standards

### **🎯 Structured Outputs Only**
**All OpenAI API calls MUST use structured outputs with Zod schemas.**

```typescript
// ✅ CORRECT - Use structured outputs with Zod
const Step = z.object({
  explanation: z.string(),
  output: z.string(),
});

const MathReasoning = z.object({
  steps: z.array(Step),
  final_answer: z.string(),
});

const completion = await openai.chat.completions.parse({
  model: "gpt-4o-2024-08-06",
  messages: [
    { role: "system", content: "You are a helpful math tutor. Guide the user through the solution step by step." },
    { role: "user", content: "how can I solve 8x + 7 = -23" },
  ],
  response_format: zodResponseFormat(MathReasoning, "math_reasoning"),
});

const math_reasoning = completion.choices[0].message
```

```typescript
// ❌ WRONG - Manual parsing, regex, or unstructured outputs
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Analyze this and return JSON" }],
  // No response_format specified
});

// Manual parsing - error prone!
const result = response.choices[0].message.content.match(/some regex/);
```

### **Why Structured Outputs?**
- **100% Reliability**: Guaranteed valid JSON, no parsing errors
- **Type Safety**: Zod validation ensures data integrity
- **Better Performance**: No retry loops for malformed responses
- **Cleaner Code**: No manual regex parsing or string manipulation
- **RAG-Ready**: Consistent structured data for database storage

### **Required Pattern**
1. **Define Zod Schema** with clear descriptions
2. **Use `response_format: json_schema`** with `strict: true`
3. **Parse with Zod** for validation
4. **Handle errors** gracefully with fallbacks

---

## 3 · Message Processing Flow

```
Telegram Message
       ↓
┌─────────────────────────────────────────────────────┐
│                 Gateway Router                       │
│  (src/gateways/telegram.ts)                        │
└─────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────┐
│            Message Type Detection                    │
└─────────────────────────────────────────────────────┘
       ↓
    ┌─────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │TEXT │    │ VOICE   │    │  FILE   │    │ PHOTO   │
    └─────┘    └─────────┘    └─────────┘    └─────────┘
       ↓            ↓              ↓              ↓
   ┌─────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │Agent│    │Transcript│    │File     │    │File     │
   │     │    │Processor │    │Processor│    │Processor│
   └─────┘    └─────────┘    └─────────┘    └─────────┘
       ↓            ↓              ↓              ↓
   ┌─────────────────────────────────────────────────────┐
   │              Main Agent                             │
   │        (src/agent/index.ts)                        │
   └─────────────────────────────────────────────────────┘
       ↓
   ┌─────────────────────────────────────────────────────┐
   │                  Tools                              │
   │  • Reminders  • Memory  • Facts  • Search           │
   └─────────────────────────────────────────────────────┘
```

---

## 4 · Directory Layout (fully isolated modules)

```
src/
 ├─ gateways/                # one module per channel
 │   ├─ telegram.ts          # message routing & type detection
 │   └─ slack.ts             # placeholder
 │
 ├─ processors/              # isolated message processors
 │   ├─ transcript.processor.ts  # voice → text (Whisper)
 │   ├─ file.processor.ts        # file analysis & summarization
 │   └─ photo.processor.ts       # image analysis & OCR
 │
 ├─ agent/                   # OpenAI Agent only
 │   ├─ index.ts             # main conversational agent
 │   └─ tools/               # each tool = 1 file
 │       ├─ scheduleReminder.tool.ts
 │       ├─ storeMemory.tool.ts
 │       ├─ upsertFact.tool.ts
 │       └─ searchMemory.tool.ts
 │
 ├─ services/                # pure domain logic, no I/O side-effects
 │   ├─ reminders.service.ts
 │   ├─ memory.service.ts
 │   ├─ facts.service.ts
 │   └─ storage.service.ts   # Supabase Storage operations
 │
 ├─ db/                      # Drizzle ORM database layer
 │   ├─ schema.ts            # TypeScript schema definitions
 │   ├─ client.ts            # Database connection & types
 │   └─ migrations/          # Generated SQL migrations
 │
 ├─ cron/                    # Supabase Edge Functions triggered by pg_cron
 │   └─ due-reminders.ts
 │
 ├─ utils/                   # stateless helpers
 │   ├─ chrono.ts            # date parsing
 │   ├─ project-context.ts   # user context management
 │   └─ file-utils.ts        # file type detection & validation
 │
 ├─ supabase/                # migrations & type generation
 │   ├─ migrations/
 │   └─ seed.sql
 └─ tests/
```

**Isolation rules**

* **Gateway modules** detect message type and route to appropriate processor
* **Processor modules** handle one media type each, return standardized text
* **Agent module** only processes text, calls tools based on intent
* **Service modules** hold all DB/Storage queries; no cross-layer imports
* **Each processor** can work independently and be tested in isolation

---

## 5 · Message Processing Scenarios

### 📝 Text Messages
```
User: "Remind me to call mom tomorrow"
Flow: Gateway → Agent → Schedule Reminder Tool → Response
```

### 🎤 Voice Messages
```
User: [Voice note: "Save this meeting recording"]
Flow: Gateway → Transcript Processor → Agent → Store Memory Tool → Response
```

### 📄 Document Files
```
User: [PDF: "quarterly_report.pdf"]
Flow: Gateway → File Processor → Summary + Storage → Agent → Store Memory Tool → Response
```

### 📸 Photos
```
User: [Photo: "whiteboard_notes.jpg"]
Flow: Gateway → Photo Processor → OCR + Analysis → Agent → Store Memory Tool → Response
```

### 🎵 Audio Files
```
User: [Audio: "lecture_recording.mp3"]
Flow: Gateway → Transcript Processor → Agent → Store Memory Tool → Response
```

---

## 6 · Processor Modules (Isolated Components)

### Transcript Processor (`src/processors/transcript.processor.ts`)
- **Input**: Voice message file from Telegram
- **Process**: OpenAI Whisper API transcription
- **Output**: Standardized text with metadata
- **Error handling**: Fallback to "[Voice message - transcription failed]"

### File Processor (`src/processors/file.processor.ts`)
- **Input**: Document files (PDF, DOCX, TXT, etc.)
- **Process**: Extract text → OpenAI summarization → Supabase Storage
- **Output**: Summary text + storage reference
- **Supported types**: PDF, DOCX, TXT, RTF, MD

### Photo Processor (`src/processors/photo.processor.ts`)
- **Input**: Images from Telegram
- **Process**: OCR (if text) + Visual analysis → Supabase Storage
- **Output**: Descriptive text + storage reference
- **Capabilities**: Text extraction, scene description, object detection

---

## 7 · Database Schema (Drizzle ORM)

### **🎯 TypeScript-First Schema**
We use **Drizzle ORM** for type-safe database operations with Supabase PostgreSQL.

```bash
# Install Drizzle
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

### **📋 Schema Definition (`src/db/schema.ts`)**

```typescript
import {
  pgTable, pgEnum, uuid, text, timestamp, integer, real, vector
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const roleEnum = pgEnum('role', ['owner', 'member']);
export const channelTypeEnum = pgEnum('channel_type', ['telegram', 'slack', 'discord']);
export const fileTypeEnum = pgEnum('file_type', ['text', 'voice', 'document', 'photo']);

// Core tables
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id'),
  displayName: text('display_name'),
});

export const projectMembers = pgTable('project_members', {
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  role: roleEnum('role').default('member'),
}, (t) => ({
  pk: primaryKey({ columns: [t.projectId, t.userId] }),
}));

export const channels = pgTable('channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  type: channelTypeEnum('type'),
  externalChatId: text('external_chat_id'),
});

// Data tables
export const reminders = pgTable('reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  scheduledFor: timestamp('scheduled_for').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const memories = pgTable('memories', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  summary: text('summary'),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI embeddings
  filePath: text('file_path'),
  fileType: fileTypeEnum('file_type'),
  metadata: text('metadata').$type<Record<string, any>>(), // JSON metadata
  createdAt: timestamp('created_at').defaultNow(),
});

export const facts = pgTable('facts', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  keyText: text('key_text').notNull(),
  valueText: text('value_text').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  confidence: real('confidence').default(1.0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations for better DX
export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(projectMembers),
  channels: many(channels),
  reminders: many(reminders),
  memories: many(memories),
  facts: many(facts),
}));

export const usersRelations = relations(users, ({ many }) => ({
  projectMemberships: many(projectMembers),
  reminders: many(reminders),
  memories: many(memories),
  facts: many(facts),
}));
```

### **🔧 Database Client (`src/db/client.ts`)**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Type-safe queries
export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type Memory = typeof schema.memories.$inferSelect;
export type NewMemory = typeof schema.memories.$inferInsert;
```

### **📝 Drizzle Configuration (`drizzle.config.ts`)**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### **🚀 Migration Workflow**

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Push to Supabase (development)
supabase db push ./drizzle/*.sql

# Or apply via Supabase migrations (production)
supabase db diff --file new_migration
supabase db push
```

### **💡 Usage Examples**

```typescript
import { db } from '@/db/client';
import { memories, users, projects } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// Type-safe inserts
const newMemory = await db.insert(memories).values({
  projectId: 'uuid...',
  userId: 'uuid...',
  content: 'Meeting notes from today',
  summary: 'Discussed Q1 goals',
  fileType: 'text',
}).returning();

// Type-safe queries with relations
const userMemories = await db.query.memories.findMany({
  where: eq(memories.userId, userId),
  orderBy: desc(memories.createdAt),
  limit: 10,
  with: {
    user: true,
    project: true,
  },
});

// Vector similarity search
const similarMemories = await db.execute(sql`
  SELECT *, embedding <=> ${queryEmbedding} as distance
  FROM memories 
  WHERE project_id = ${projectId}
  ORDER BY embedding <=> ${queryEmbedding}
  LIMIT 5
`);
```

### **🎯 Benefits**

- **100% Type Safety**: Schema changes instantly reflect in TypeScript
- **Migration Safety**: Generated SQL migrations, no manual errors  
- **IDE Support**: Full autocompletion for tables, columns, relations
- **Performance**: Generates optimized SQL, no ORM overhead
- **Supabase Compatible**: Works seamlessly with pgvector, RLS, etc.
```

---

## 8 · Agent Tools (overview)

| Tool                 | Purpose                                                           | Calls                             |
| -------------------- | ----------------------------------------------------------------- | --------------------------------- |
| **scheduleReminder** | Insert/update `reminders`, compute repeat rule.                   | `reminders.service`               |
| **storeMemory**      | Upload processed file to Storage, create summary & embedding.     | `memory.service`, `storage.service` |
| **upsertFact**       | Top-5 nearest keys → LLM re-rank → UPSERT `facts`.                | `facts.service`                   |
| **searchMemory**     | Vector search in `memories`; return inline text or file reference. | `memory.service`                  |

---

## 9 · Installation

```bash
pnpm i
pnpm add @openai/agents @openai/openai @supabase/supabase-js telegraf
pnpm add drizzle-orm postgres zod
pnpm add -D @types/telegraf drizzle-kit
pnpm supabase:start          # local Postgres with pgvector/cron
pnpm supabase:migrate
pnpm dev                     # tsx watch
```

Environment variables (`.env.local`):

```
TELEGRAM_BOT_TOKEN=          # From @BotFather
OPENAI_API_KEY=             # From OpenAI Dashboard
OPENAI_ORG_ID=              # From OpenAI Dashboard (optional)
SUPABASE_URL=               # From Supabase Dashboard
SUPABASE_ANON_KEY=          # From Supabase Dashboard
DATABASE_URL=               # PostgreSQL connection string
```

### **Database Setup**

```bash
# Generate Drizzle schema migrations
npx drizzle-kit generate:pg

# Apply to Supabase (development)
supabase db push ./drizzle/*.sql

# Generate TypeScript types
npx drizzle-kit introspect:pg
```

---

## 10 · Testing & CI

```bash
pnpm lint           # biome check
pnpm test           # vitest
pnpm supabase:test  # integration tests in Docker
```

All three commands run in Cursor CI; zero red lines before merging.

---

## 11 · Deployment

```bash
pnpm supabase:deploy        # pushes Edge Functions & migrations
```

Supabase Free Tier handles cron; upgrade if you need guaranteed ≤1 min jitter.

---

## 12 · Operating Costs (≈10 users, 3 projects)

| Item                                       | Volume       | Cost                 |
| ------------------------------------------ | ------------ | -------------------- |
| Supabase Free Tier                         | —            | \$0                  |
| OpenAI embeddings (text-embedding-3-small) | \~2 M tokens | \$0.20               |
| OpenAI Whisper transcription               | \~10 hours   | \$0.60               |
| OpenAI GPT-4o-mini (agents + processing)   | \~1 M tokens | \$0.15               |
| **Total**                                  |              | **≈ \$0.95 / month** |

---

## 13 · Roadmap

### Phase 1: Core Processing (Current)
* ✅ Telegram gateway with message type detection
* ✅ Transcript processor (Whisper integration)
* ✅ Photo processor (OCR + vision with structured outputs)
* 🔄 File processor (document analysis)
* 🔄 Drizzle ORM schema + database client setup

### Phase 2: Advanced Features
* Multi-threaded conversations (persistent context)
* Slack & Discord gateway modules
* Client-side AES-GCM encrypted "secret file" mode
* Advanced search with faceted filters

### Phase 3: Intelligence
* Proactive reminders based on patterns
* Smart categorization of memories
* Cross-reference facts automatically
* HNSW index optimization for large datasets
```
