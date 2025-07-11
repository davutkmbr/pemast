# Pemast - Personal Memory Assistant

AI-powered personal assistant that processes multi-modal messages (text, voice, photos, documents) and creates searchable memories with semantic understanding.

Built with **Node.js + TypeScript**, **OpenAI APIs**, and **Supabase** (PostgreSQL + pgvector + Storage + Cron).

---

## 🏗️ Current Implementation Status

### ✅ **Completed - Core Infrastructure**
- **Database Schema**: Full schema with Messages, Memories, Facts, Files, Projects, Channels
- **Generic Gateway System**: Platform-agnostic message processing pipeline
- **Type-Safe Pipeline**: Centralized types from database schema (no manual enum definitions)
- **Clean Modern Architecture**: No legacy code, senior-level implementation

### ✅ **Completed - Message Processing**
- **TelegramGateway**: Modern message handling with auto user/project/channel creation
- **MessageRouter**: Clean routing without legacy conversions
- **TelegramExtractor**: Direct modern ProcessedMessage creation
- **Error Handling**: Graceful degradation when database offline

### ✅ **Completed - AI Processors**
- **VoiceProcessor**: OpenAI Whisper transcription with modern ProcessedMessage format
- **PhotoProcessor**: GPT-4 Vision analysis (OCR + description + insights) with modern format
- **ResponseFormatter**: Modern format support for all message types

### 🚧 **In Progress - Message-Memory-File Relationship**

#### **Current Strategy: Message-Memory-File Integration**

**Processing Rules:**
1. **Voice Messages**: Transcript only → stored in `messages.content` (NO memory created)
2. **Photos/Documents/Files**: Analysis + Summary → stored in both `messages.content` AND `memories` table
3. **Processing Order**: AI processing → File storage → Message storage → Memory creation (if applicable)
4. **Relationship Chain**: `file.id` → `message.fileId` → `memory.messageId` + `memory.fileId`

**Flow Examples:**
```typescript
// Voice Message Flow (NO MEMORY)
1. Voice arrives → TelegramVoiceProcessor
2. Download + Store file → files table
3. Transcribe (OpenAI Whisper) 
4. messages.content = transcribed_text
5. messages.fileId = stored_file_id
// ❌ NO memory created for voice

// Photo Message Flow (WITH MEMORY)
1. Photo arrives → TelegramPhotoProcessor
2. Download + Store file → files table  
3. Analyze (GPT-4 Vision: OCR + description)
4. messages.content = caption || "[Photo analyzed]"
5. messages.fileId = stored_file_id
6. memory.content = OCR_text + description + insights
7. memory.summary = brief_summary_for_search
8. memory.fileId = stored_file_id
9. memory.messageId = message_id
// ✅ Full message-memory-file linkage

// Document Flow (WITH MEMORY) - TODO
1. Document arrives → DocumentProcessor
2. Download + Store file → files table
3. Extract text + Summarize  
4. messages.content = "[Document: filename - analyzed]"
5. messages.fileId = stored_file_id
6. memory.content = extracted_text + summary
7. memory.fileId = stored_file_id
8. memory.messageId = message_id
```

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
   │Agent│    │Transcript│    │File     │    │Photo    │
   │     │    │Processor │    │Processor│    │Processor│
   └─────┘    └─────────┘    └─────────┘    └─────────┘
       ↓            ↓              ↓              ↓
   ┌─────────────────────────────────────────────────────┐
   │              Database Storage                       │
   │        Messages → Memories → Files                 │
   └─────────────────────────────────────────────────────┘
```

---

## 4 · Directory Layout (fully isolated modules)

```
src/
├─ types/index.ts           # Centralized types (single source of truth)
├─ gateways/                # Platform integrations
│   ├─ types.ts            # Gateway interfaces
│   ├─ message-router.ts   # Message routing logic
│   ├─ response-formatter.ts # Response formatting
│   └─ telegram/
│       ├─ telegram-gateway.ts     # Main Telegram integration
│       ├─ telegram-extractor.ts   # Basic message extraction
│       ├─ telegram-voice-processor.ts   # Voice processing
│       └─ telegram-photo-processor.ts   # Photo processing
├─ processors/              # AI processing modules
│   ├─ transcript.processor.ts    # OpenAI Whisper integration
│   └─ photo.processor.ts         # GPT-4 Vision integration
├─ services/                # Pure business logic
│   ├─ message-processing.service.ts  # Generic message pipeline
│   ├─ message.service.ts             # Message CRUD operations
│   ├─ user.service.ts                # User management
│   ├─ project.service.ts             # Project management
│   ├─ channel.service.ts             # Channel management
│   ├─ memory.service.ts              # Memory operations (TODO)
│   ├─ facts.service.ts               # Facts operations (TODO)
│   └─ reminders.service.ts           # Reminders operations (TODO)
├─ db/                      # Drizzle ORM database layer
│   ├─ schema.ts            # Database schema with enums
│   ├─ client.ts            # Type-safe database client
│   └─ migrations/          # Generated SQL migrations
├─ agent/                   # OpenAI Agent (TODO)
│   ├─ index.ts             # main conversational agent
│   └─ tools/               # each tool = 1 file
│       ├─ scheduleReminder.tool.ts
│       ├─ storeMemory.tool.ts
│       ├─ upsertFact.tool.ts
│       └─ searchMemory.tool.ts
├─ cron/                    # Supabase Edge Functions triggered by pg_cron
│   └─ due-reminders.ts
└─ utils/                   # stateless helpers
    ├─ chrono.ts            # date parsing
    ├─ project-context.ts   # user context management
    └─ file-utils.ts        # file type detection & validation
```

**Isolation rules**

* **Gateway modules** detect message type and route to appropriate processor
* **Processor modules** handle one media type each, return standardized ProcessedMessage
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
Flow: Gateway → Transcript Processor → Database → Memory Creation → Response
```

### 📄 Document Files
```
User: [PDF: "quarterly_report.pdf"]
Flow: Gateway → File Processor → Summary + Storage → Memory Creation → Response
```

### 📸 Photos
```
User: [Photo: "whiteboard_notes.jpg"]
Flow: Gateway → Photo Processor → OCR + Analysis → Memory Creation → Response
```

### 🎵 Audio Files
```
User: [Audio: "lecture_recording.mp3"]
Flow: Gateway → Transcript Processor → Memory Creation → Response
```

---

## 6 · Database Schema (Drizzle ORM)

### **🎯 TypeScript-First Schema**
We use **Drizzle ORM** for type-safe database operations with Supabase PostgreSQL.

### **📋 Core Tables**
- **`projects`**: User workspaces (auto-created per gateway)
- **`users`**: Cross-platform user records (auto-created from external IDs)
- **`channels`**: Gateway-specific chat connections (auto-created)
- **`messages`**: Raw message content + processing metadata
- **`files`**: File metadata + storage references  
- **`memories`**: Processed content + summaries + embeddings (searchable)
- **`facts`**: Key-value structured knowledge (current state)
- **`reminders`**: Scheduled notifications with recurrence support

### **🔗 Key Relationships**
```sql
messages.id → memories.messageId  -- Every significant message creates memory
files.id → memories.fileId        -- File attachments linked to memories
files.id → messages.fileId        -- Original file reference
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

### **🚀 Migration Workflow**

```bash
# Generate migration from schema changes
pnpm db:generate

# Push to Supabase (development)
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

---

## 7 · Agent Tools (overview)

| Tool                 | Purpose                                                           | Calls                             |
| -------------------- | ----------------------------------------------------------------- | --------------------------------- |
| **scheduleReminder** | Insert/update `reminders`, compute repeat rule.                   | `reminders.service`               |
| **storeMemory**      | Upload processed file to Storage, create summary & embedding.     | `memory.service`, `storage.service` |
| **upsertFact**       | Top-5 nearest keys → LLM re-rank → UPSERT `facts`.                | `facts.service`                   |
| **searchMemory**     | Vector search in `memories`; return inline text or file reference. | `memory.service`                  |

---

## 8 · AI Processing Pipeline

### **Memory Creation Logic**
```typescript
// Memory created for:
✅ Voice messages (transcribed content)
✅ Photos (OCR + analysis) 
✅ Documents (extracted + summarized)
❌ Simple text messages (stored in messages only)

// Processing metadata includes:
- processor: 'voice' | 'photo' | 'document'
- confidence: number
- extractedText?: string (for photos/docs)
- keyInsights?: string[] (AI-generated insights)
- error?: string (if processing failed)
```

### **Semantic Processing**
- **Voice**: OpenAI Whisper → transcribed text
- **Photos**: GPT-4 Vision → OCR + visual analysis + insights
- **Documents**: Text extraction → OpenAI summarization (TODO)
- **Embeddings**: OpenAI text-embedding-3-small for semantic search

---

## 9 · Installation

```bash
pnpm i
pnpm add @openai/agents @openai/openai @supabase/supabase-js telegraf
pnpm add drizzle-orm postgres zod
pnpm add -D @types/telegraf drizzle-kit
```

Environment variables (`.env.local`):

```
TELEGRAM_BOT_TOKEN=          # From @BotFather
OPENAI_API_KEY=             # From OpenAI Dashboard
SUPABASE_URL=               # From Supabase Dashboard
SUPABASE_ANON_KEY=          # From Supabase Dashboard (for Storage)
SUPABASE_SERVICE_ROLE_KEY=  # Optional: From Supabase Dashboard (bypasses RLS)
SUPABASE_STORAGE_BUCKET=    # Optional: Bucket name (default: pemast-files)
DATABASE_URL=               # PostgreSQL connection string
```

### **Database Setup**

```bash
# Generate Drizzle schema migrations
pnpm db:generate

# Push to Supabase (development)
pnpm db:push

# Generate TypeScript types
pnpm supabase:gen
```

### **Supabase Storage Setup**

1. Go to your Supabase Dashboard → Storage
2. Create a new bucket named `pemast-files`
3. Set bucket to **Private** (files accessed via signed URLs)
4. Optionally configure file size limits and allowed file types

### **Service Role Key Setup (RLS Bypass)**

1. Go to **Settings** → **API** in your Supabase Dashboard
2. Copy the **service_role** key (not the anon key)
3. Add to your `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
4. This bypasses Row Level Security for file uploads

**Alternative**: If you prefer, you can make the storage bucket **Public** instead of using service role.

---

## 10 · Development Scripts

```bash
pnpm dev              # Start development server
pnpm build            # Build for production  
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Drizzle Studio
pnpm supabase:gen     # Generate TypeScript types
pnpm lint             # biome check
pnpm test             # vitest (when implemented)
```

---

## 11 · Testing & CI

```bash
pnpm lint           # biome check
pnpm test           # vitest
pnpm supabase:test  # integration tests in Docker
```

All three commands run in Cursor CI; zero red lines before merging.

---

## 12 · Deployment

```bash
pnpm supabase:deploy        # pushes Edge Functions & migrations
```

Supabase Free Tier handles cron; upgrade if you need guaranteed ≤1 min jitter.

---

## 13 · Operating Costs (≈10 users, 3 projects)

| Item                                       | Volume       | Cost                 |
| ------------------------------------------ | ------------ | -------------------- |
| Supabase Free Tier                         | —            | \$0                  |
| OpenAI embeddings (text-embedding-3-small) | \~2 M tokens | \$0.20               |
| OpenAI Whisper transcription               | \~10 hours   | \$0.60               |
| OpenAI GPT-4o-mini (agents + processing)   | \~1 M tokens | \$0.15               |
| **Total**                                  |              | **≈ \$0.95 / month** |

---

## 14 · Roadmap

### Phase 1: Message-Memory-File Integration (Current)
* ✅ Telegram gateway with modern message processing
* ✅ Voice processor (Whisper integration) - Modern format
* ✅ Photo processor (GPT-4 Vision) - Modern format
* ✅ **Supabase Storage integration for real file uploads**
* 🔄 Complete Message→Memory→File relationship
* 🔄 File processor (document analysis)

### Phase 2: AI Agent & Search
* Conversational AI agent with tool calling
* Semantic search with embeddings
* Facts management system
* Reminder system with recurrence

### Phase 3: Advanced Features
* Multi-threaded conversations (persistent context)
* Slack & Discord gateway modules
* Client-side AES-GCM encrypted "secret file" mode
* Advanced search with faceted filters

### Phase 4: Intelligence
* Proactive reminders based on patterns
* Smart categorization of memories
* Cross-reference facts automatically
* HNSW index optimization for large datasets

---

## 🎯 Design Principles

1. **Single Source of Truth**: All types derived from database schema
2. **Generic Architecture**: Platform-agnostic message processing
3. **Type Safety**: Full TypeScript coverage with exactOptionalPropertyTypes
4. **Clean Separation**: Gateway → Processing → Storage → AI
5. **Error Resilience**: Graceful degradation, offline capability
6. **Scalable**: Easy to add new gateways and processors

---

*Built with clean architecture principles and senior-level TypeScript practices.*
