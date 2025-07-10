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
| **Database**             | Supabase Free Tier      | PostgreSQL 15 + pgvector + pg\_cron + Storage.      |
| **Tests / CI**           | `vitest`, `happydom`    | Fast unit & integration tests.                      |
| **Task runner**          | `pnpm`                  | Uniform scripts (`dev`, `test`, `deploy`).          |

---

## 2 · Message Processing Flow

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

## 3 · Directory Layout (fully isolated modules)

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

## 4 · Message Processing Scenarios

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

## 5 · Processor Modules (Isolated Components)

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

## 6 · Database Schema (essential tables)

```sql
-- Projects (personal or team)
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Users
create table users (
  id uuid primary key default gen_random_uuid(),
  external_id text,          -- channel user id
  display_name text
);

-- Memberships (many-to-many)
create table project_members (
  project_id uuid references projects on delete cascade,
  user_id    uuid references users    on delete cascade,
  role       text default 'member',
  primary key (project_id, user_id)
);

-- Channels bound to a project
create table channels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  type text,                 -- 'telegram', 'slack', ...
  external_chat_id text
);

-- Enhanced data tables (all carry project_id & user_id for RLS)
create table reminders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  user_id uuid references users on delete cascade,
  content text not null,
  scheduled_for timestamptz not null,
  created_at timestamptz default now()
);

create table memories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  user_id uuid references users on delete cascade,
  content text not null,
  summary text,
  embedding vector(1536),     -- OpenAI embeddings
  file_path text,             -- Supabase Storage path
  file_type text,             -- 'text', 'voice', 'document', 'photo'
  metadata jsonb,             -- processor-specific data
  created_at timestamptz default now()
);

create table facts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  user_id uuid references users on delete cascade,
  key_text text not null,
  value_text text not null,
  embedding vector(1536),     -- for semantic search
  confidence real default 1.0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
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

## 8 · Installation

```bash
pnpm i
pnpm add @openai/agents @openai/openai @supabase/supabase-js telegraf
pnpm add -D @types/telegraf
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
```

---

## 9 · Testing & CI

```bash
pnpm lint           # biome check
pnpm test           # vitest
pnpm supabase:test  # integration tests in Docker
```

All three commands run in Cursor CI; zero red lines before merging.

---

## 10 · Deployment

```bash
pnpm supabase:deploy        # pushes Edge Functions & migrations
```

Supabase Free Tier handles cron; upgrade if you need guaranteed ≤1 min jitter.

---

## 11 · Operating Costs (≈10 users, 3 projects)

| Item                                       | Volume       | Cost                 |
| ------------------------------------------ | ------------ | -------------------- |
| Supabase Free Tier                         | —            | \$0                  |
| OpenAI embeddings (text-embedding-3-small) | \~2 M tokens | \$0.20               |
| OpenAI Whisper transcription               | \~10 hours   | \$0.60               |
| OpenAI GPT-4o-mini (agents + processing)   | \~1 M tokens | \$0.15               |
| **Total**                                  |              | **≈ \$0.95 / month** |

---

## 12 · Roadmap

### Phase 1: Core Processing (Current)
* ✅ Telegram gateway with message type detection
* 🔄 Transcript processor (Whisper integration)
* 🔄 File processor (document analysis)
* 🔄 Photo processor (OCR + vision)

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