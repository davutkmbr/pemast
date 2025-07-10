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
| **Multi-project**                           | Personal project and team workspace share code but keep data separate.  | Row-Level Security isolates each `project_id`.                                    |
| **Multi-channel**                           | Telegram today, Slack/Discord tomorrow.                                 | Gateway modules know how to post/receive, rest of the system is channel-agnostic. |

---

## 1 · Tech Stack

| Layer             | Package                 | Responsibility                                      |
| ----------------- | ----------------------- | --------------------------------------------------- |
| **Gateway**       | `telegraf`              | Modern Telegram bot framework with built-in middleware. |
| **Agent runtime** | `@openai/agents`        | Parses user utterances, decides which tool to call. |
| **Database**      | Supabase Free Tier      | PostgreSQL 15 + pgvector + pg\_cron + Storage.      |
| **Tests / CI**    | `vitest`, `happydom`    | Fast unit & integration tests.                      |
| **Task runner**   | `pnpm`                  | Uniform scripts (`dev`, `test`, `deploy`).          |

---

## 2 · Directory Layout (fully isolated modules)

```
src/
 ├─ gateways/                # one module per channel
 │   ├─ telegram.ts          
 │   └─ slack.ts             # placeholder
 │
 ├─ agent/                   # OpenAI Agent only
 │   ├─ index.ts             # agent config
 │   └─ tools/               # each tool = 1 file
 │       ├─ scheduleReminder.tool.ts
 │       ├─ storeMemory.tool.ts
 │       ├─ upsertFact.tool.ts
 │       └─ searchMemory.tool.ts
 │
 ├─ services/                # pure domain logic, no I/O side-effects
 │   ├─ reminders.service.ts
 │   ├─ memory.service.ts
 │   └─ facts.service.ts
 │
 ├─ cron/                    # Supabase Edge Functions triggered by pg_cron
 │   └─ due-reminders.ts
 │
 ├─ utils/                   # stateless helpers (date parsing, embedding)
 │   ├─ chrono.ts
 │   └─ project-context.ts
 │
 ├─ supabase/                # migrations & type generation
 │   ├─ migrations/
 │   └─ seed.sql
 └─ tests/
```

**Isolation rules**

* **Gateway modules** translate network payload → `{text, metadata}` object, nothing else.
* **Service modules** hold all DB queries; no direct imports from gateways or agent.
* **Agent tools** call a single service each; never reach across layers.

---

## 3 · Database Schema (essential tables)

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

-- Data tables (all carry project_id & user_id for RLS)
create table reminders ( ... );
create table memories  ( ... );
create table facts     ( ... );
```

Row-Level Security enforces `project_id = jwt.claims.project_id` on every table.

---

## 4 · Agent Tools (overview)

| Tool                 | Purpose                                                           | Calls                             |
| -------------------- | ----------------------------------------------------------------- | --------------------------------- |
| **scheduleReminder** | Insert/update `reminders`, compute repeat rule.                   | `reminders.service`               |
| **storeMemory**      | Upload file (if any) to Storage, create summary & embedding.      | `memory.service`   `utils/chrono` |
| **upsertFact**       | Top-5 nearest keys → LLM re-rank → UPSERT `facts`.                | `facts.service`                   |
| **searchMemory**     | Vector search in `memories`; return inline text or Telegram file. | `memory.service`                  |

---

## 5 · Installation

```bash
pnpm i
pnpm add @openai/agents @supabase/supabase-js telegraf
pnpm add -D @types/telegraf
pnpm supabase:start          # local Postgres with pgvector/cron
pnpm supabase:migrate
pnpm dev                     # nodemon + ts-node
# set Telegram webhook once
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
     -d "url=https://<supabase-project>.functions.supabase.co/telegram"
```

Environment variables (`.env.example`):

```
TELEGRAM_BOT_TOKEN=
SUPABASE_URL=
SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_ORG_ID=
```

---

## 6 · Testing & CI

```bash
pnpm lint           # eslint + prettier check
pnpm test           # vitest
pnpm supabase:test  # integration tests in Docker
```

All three commands run in Cursor CI; zero red lines before merging.

---

## 7 · Deployment

```bash
pnpm supabase:deploy        # pushes Edge Functions & migrations
```

Supabase Free Tier handles cron; upgrade if you need guaranteed ≤1 min jitter.

---

## 8 · Operating Costs (≈10 users, 3 projects)

| Item                                       | Volume       | Cost                 |
| ------------------------------------------ | ------------ | -------------------- |
| Supabase Free Tier                         | —            | \$0                  |
| OpenAI embeddings (text-embedding-3-small) | \~2 M tokens | \$0.20               |
| **Total**                                  |              | **≈ \$0.20 / month** |

---

## 9 · Roadmap

* Slack & Discord gateway modules.
* Client-side AES-GCM encrypted "secret file" mode.
* Whisper transcription for voice notes.
* HNSW index once `facts.key` > 5 k rows.