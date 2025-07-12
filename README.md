# Pemast - Personal Memory Assistant

AI-powered personal assistant that processes multi-modal messages (text, voice, photos, documents) and creates searchable memories with semantic understanding.

Built with **Node.js + TypeScript**, **OpenAI APIs**, and **Supabase** (PostgreSQL + pgvector + Storage).

---

## 🏗️ Implementation Status

### ✅ **Completed - Core Infrastructure**
- **Database Schema**: Complete normalized schema with Messages, Memories, Facts, Files, Projects, Channels
- **Clean Architecture**: Refactored with dependency injection and platform-agnostic design
- **Type-Safe Pipeline**: Centralized types from database schema (single source of truth)
- **Vector Search**: Semantic search with OpenAI embeddings and pgvector
- **Modular Prompt System**: String builder utilities and composable prompt sections

### ✅ **Completed - Message Processing**
- **TelegramGateway V2**: Modern message handling with dependency injection
- **Core Message Pipeline**: Platform-agnostic processing pipeline
- **File Processing**: Complete file upload/download with Supabase Storage
- **Smart Memory Creation**: Automatic deduplication and semantic categorization

### ✅ **Completed - AI Processors**
- **VoiceProcessor**: OpenAI Whisper transcription with modern format
- **PhotoProcessor**: GPT-4 Vision analysis (OCR + description + insights)
- **Memory Management**: Smart deduplication with similarity detection
- **Embedding Service**: Centralized semantic search with text-embedding-3-small

### ✅ **Completed - AI Agent System**
- **Main Agent**: Conversational AI with OpenAI Agents framework
- **Memory Tools**: Store and search memories with semantic understanding
- **User Preferences**: Modular preference system with validation and response builders
- **Streaming UI**: Real-time responses with platform-specific UI adapters
- **Personal Context**: Dynamic context injection from user memories

### 🚧 **In Progress / Planned**
- **Document Processor**: PDF/text file analysis (structure in place)
- **Facts Management**: Structured knowledge upserts (schema ready)
- **Reminder System**: Scheduled notifications with recurrence (implemented, needs testing)
- **Multi-Gateway Support**: Slack, Discord integrations (architecture ready)

---

## 🎯 Key Features

| Capability                                  | Example utterance                                                       | Behaviour                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Smart Memory Storage**                    | "Remember that I'm a React developer from Turkey"                      | Creates categorized memories with semantic search and auto-deduplication          |
| **Multi-modal Processing**                  | Voice messages, documents, photos                                        | Transcripts, analyzes, and stores with semantic search capabilities              |
| **Semantic Memory Search**                  | "What do you know about my work experience?"                           | Vector search across memories with relevance ranking                             |
| **Personal Context Injection**              | Agent maintains context from previous conversations                      | Dynamically loads relevant memories for personalized responses                   |
| **Customizable Behavior**                   | "Set language to Turkish, be more casual"                              | User preferences with modular prompt system and validation                      |
| **File Analysis & Storage**                 | Upload documents, photos, voice notes                                   | Processes content, extracts text, creates searchable memories                   |
| **Platform-Agnostic Architecture**         | Works with Telegram, extensible to Slack/Discord                       | Clean separation between gateways and business logic                            |

---

## 🔄 Message Processing Flow

```
Telegram Message
       ↓
┌─────────────────────────────────────────────────────┐
│            TelegramGateway V2                       │
│  (Dependency Injection + Clean Architecture)       │
└─────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────┐
│           Core Message Pipeline                     │
│     (Platform-agnostic processing)                 │
└─────────────────────────────────────────────────────┘
       ↓
    ┌─────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │TEXT │    │ VOICE   │    │  PHOTO  │    │  FILE   │
    └─────┘    └─────────┘    └─────────┘    └─────────┘
       ↓            ↓              ↓              ↓
   ┌─────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │Agent│    │Whisper  │    │GPT-4    │    │Document │
   │     │    │Processor│    │Vision   │    │Processor│
   └─────┘    └─────────┘    └─────────┘    │(Planned)│
       ↓            ↓              ↓        └─────────┘
   ┌─────────────────────────────────────────────────────┐
   │           File Storage + Database                   │
   │    Files → Messages → Memories (with embeddings)   │
   └─────────────────────────────────────────────────────┘
       ↓
   ┌─────────────────────────────────────────────────────┐
   │        Streaming AI Response                        │
   │   (Real-time UI updates + Tool execution)          │
   └─────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture Overview

### **Core Components**

#### **1. Gateway Layer** (`src/gateways/`)
- **Platform-agnostic interfaces**: `StreamingUI`, `MessagePipeline`
- **TelegramGateway V2**: Modern implementation with dependency injection
- **Processor Registration**: Plugin-style architecture for different message types

#### **2. Core Processing** (`src/core/`)
- **MessagePipeline**: Platform-agnostic message processing
- **ReplyGenerator**: AI response generation (streaming + non-streaming)
- **FileProcessorPipeline**: Unified file handling workflow

#### **3. AI Agent System** (`src/agent/`)
- **Main Agent**: Conversational AI with tool support
- **Tools**: Memory storage, search, user preferences, web search
- **Personal Context**: Dynamic memory injection for personalized responses

#### **4. Services Layer** (`src/services/`)
- **Memory Management**: Creation, search, deduplication
- **File Handling**: Upload, download, metadata management
- **User Preferences**: Type-safe preference management with validation
- **Embedding**: Centralized semantic search operations
- **Message Processing**: Complete message lifecycle management

#### **5. Database Layer** (`src/db/`)
- **Normalized Schema**: Projects, Users, Messages, Memories, Files, Facts, Reminders
- **Vector Support**: pgvector for semantic search
- **Type Safety**: Full TypeScript integration with Drizzle ORM

#### **6. Utilities Layer** (`src/utils/`)
- **String Builder**: clsx-inspired utility for conditional string composition
- **Response Builders**: Modular response message construction
- **Vector Search**: Generic semantic search operations
- **Prompt Utilities**: Reusable prompt building functions

---

## 🧱 Modular Code Architecture

### **String Builder Pattern**
We've implemented a clsx-inspired utility for building strings conditionally:

```typescript
import { stringBuilder } from './utils/string-builder.js';

// Conditional string composition
const prompt = stringBuilder(
  "Base text\n",
  condition && "Conditional text\n",
  { "Text if true\n": booleanValue },
  ["Multiple", " strings", condition && " conditionally"]
);
```

### **Modular Prompt System** 
Prompts are now composed from reusable sections:

```typescript
// Before: 200+ lines of if/else string concatenation
// After: Clean, composable functions
return stringBuilder(
  buildCommunicationStyleSection(preferences.communication_style),
  buildLanguageSection(preferences.language, preferences.communication_style),
  buildResponseLengthSection(preferences.response_length),
  buildCoreRulesSection()
);
```

### **User Preferences Architecture**
- **Type-Safe Validation**: Zod schemas for each preference type
- **Modular Responses**: Dedicated response builders for different scenarios
- **Clean Tool Implementation**: Separated validation, processing, and response logic

---

## 📁 Directory Structure

```
src/
├─ types/index.ts           # Centralized types (single source of truth)
├─ core/                    # Platform-agnostic business logic
│   ├─ message-pipeline.ts        # Core message processing
│   ├─ reply-generator.ts         # AI response generation
│   ├─ streaming-reply-generator.ts # Real-time UI responses
│   └─ file-processor-pipeline.ts # File processing workflow
├─ gateways/                # Platform integrations
│   ├─ types.ts                   # Gateway interfaces
│   ├─ base-gateway.ts           # Base gateway class
│   └─ telegram/
│       ├─ telegram-gateway.ts          # Main Telegram integration V2
│       ├─ telegram-extractor.ts        # Message extraction
│       ├─ telegram-voice-processor.ts  # Voice processing
│       ├─ telegram-photo-processor.ts  # Photo processing
│       ├─ telegram-file-downloader.ts  # File download utility
│       └─ telegram-streaming-ui.ts     # Platform-specific UI
├─ agent/                   # AI Agent system
│   ├─ main-agent.ts              # OpenAI Agents integration
│   ├─ intent-classifier.ts      # Message intent detection
│   └─ tools/                     # Agent tools
│       ├─ store-memory.tool.ts        # Memory storage with deduplication
│       ├─ search-memory.tool.ts       # Semantic memory search
│       └─ set-user-preference.tool.ts # User preference management
├─ processors/              # Generic AI processors
│   ├─ transcript.processor.ts    # OpenAI Whisper integration
│   └─ photo.processor.ts         # GPT-4 Vision integration
├─ services/                # Business logic services
│   ├─ message-processing.service.ts    # Message lifecycle management
│   ├─ memory.service.ts                # Memory CRUD + search
│   ├─ memory-deduplication.service.ts  # Smart memory deduplication
│   ├─ user-preferences.service.ts      # Type-safe preference management
│   ├─ embedding.service.ts             # Centralized embedding operations
│   ├─ file.service.ts                  # File storage + metadata
│   ├─ reminder.service.ts              # Scheduled reminders
│   ├─ user.service.ts                  # User management
│   ├─ project.service.ts               # Project management
│   ├─ channel.service.ts               # Channel management
│   └─ message.service.ts               # Message CRUD operations
├─ prompts/                 # AI prompt templates
│   ├─ main-agent.prompt.ts       # Dynamic agent prompt generation
│   ├─ main-agent.md              # Agent behavior documentation
│   ├─ store-memory-tool.md       # Memory tool guidelines
│   └─ intent-classifier.md       # Intent classification prompts
├─ db/                      # Database layer
│   ├─ schema.ts                 # Complete normalized schema
│   ├─ client.ts                 # Type-safe database client
│   └─ migrations/               # SQL migrations
├─ utils/                   # Utilities
│   ├─ string-builder.ts         # clsx-inspired string composition
│   ├─ preference-response-builder.ts # Modular preference responses
│   ├─ vector-search.ts          # Generic vector search helper
│   ├─ project-context.ts        # User context management
│   ├─ file-utils.ts             # File type detection
│   └─ prompts.ts                # AI prompt building
└─ cron/                    # Scheduled jobs (TODO)
    └─ due-reminders.ts          # Reminder notifications
```

---

## 💾 Database Schema

### **Core Tables**
- **`projects`**: User workspaces with isolation
- **`users`**: Cross-platform user records
- **`channels`**: Gateway-specific chat connections
- **`messages`**: Raw message content + metadata
- **`files`**: File storage with Supabase integration
- **`memories`**: Processed content with semantic search
- **`user_preferences`**: Type-safe user customization settings
- **`facts`**: Structured knowledge (schema ready)
- **`reminders`**: Scheduled notifications with recurrence

### **Key Relationships**
```sql
-- Complete message-memory-file linkage
files.id → messages.fileId → memories.messageId + memories.fileId

-- User context and permissions
projects.id → project_members.projectId → users.id
channels.projectId → projects.id

-- User preferences for personalization
user_preferences.userId → users.id
user_preferences.projectId → projects.id
```

### **Vector Search Integration**
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Storage**: pgvector extension in PostgreSQL
- **Search Types**: Semantic similarity, text matching, tag filtering

---

## 🤖 AI Agent System

### **Agent Configuration**
```typescript
// Main conversational agent with tools
const agent = new Agent({
  name: "main-agent",
  model: "gpt-4",
  modelSettings: { parallelToolCalls: true },
  instructions: dynamicSystemPrompt,
  tools: [searchMemoryTool, storeMemoryTool, setUserPreferenceTool, webSearchTool()]
});
```

### **Available Tools**

| Tool | Purpose | Implementation |
|------|---------|----------------|
| **store_memory** | Smart memory storage with deduplication | Auto-categorization, similarity detection |
| **search_memory** | Semantic memory search | Vector search + text matching + tags |
| **set_user_preference** | User behavior customization | Type-safe preference validation and storage |
| **web_search** | Real-time web information | OpenAI Agents built-in tool |

### **Personal Context System**
- **Dynamic Loading**: Agent loads relevant memories before each conversation
- **Context Injection**: Recent memories become part of system prompt
- **Semantic Relevance**: Uses embeddings to find contextually relevant information
- **User Preferences**: Personalizes communication style, language, and behavior

---

## ⚙️ User Preferences System

### **Available Preferences**
```typescript
// Language & Communication
language: "tr" | "en" | "de" | "fr" | "es"
communication_style: "formal" | "casual" | "friendly" | "professional" | "humorous"
response_tone: "neutral" | "warm" | "enthusiastic" | "calm" | "direct"
response_length: "brief" | "medium" | "detailed" | "comprehensive"

// Assistant Behavior
assistant_personality: "helpful" | "wise" | "creative" | "analytical" | "empathetic"
emoji_usage: "none" | "minimal" | "moderate" | "frequent"

// Other Settings
greeting_style: string
reminder_format: string
reminder_time_preference: string
```

### **Type-Safe Implementation**
- **Zod Validation**: Each preference type has its own schema
- **Discriminated Unions**: Type-safe key-value pairing
- **Modular Responses**: Clean, composable response builders
- **Dynamic Prompts**: Preferences automatically influence agent behavior

---

## 📝 Memory Management

### **Memory Categories**
```typescript
const CORE_MEMORY_CATEGORIES = [
  'personal_info', 'work', 'preference', 'skill', 'project',
  'contact', 'location', 'health', 'finance', 'family',
  'education', 'hobby', 'goal', 'knowledge', 'note'
] as const;
```

### **Smart Deduplication**
- **Similarity Detection**: Compares new memories with existing ones
- **Automatic Actions**: Create new, update existing, or skip duplicates
- **Confidence Scoring**: ML-based similarity assessment

### **Search Capabilities**
- **Semantic Search**: Vector similarity with OpenAI embeddings
- **Text Search**: Fuzzy matching on content and summaries
- **Tag Filtering**: Category-based and custom tag search
- **Combined Results**: Unified search across all methods

---

## 🔧 Installation & Setup

### **Prerequisites**
```bash
# Install dependencies
pnpm install

# Required environment variables
cp .env.example .env.local
```

### **Environment Variables**
```bash
# .env.local
TELEGRAM_BOT_TOKEN=           # From @BotFather
OPENAI_API_KEY=              # From OpenAI Dashboard
DATABASE_URL=                # PostgreSQL connection string
SUPABASE_URL=                # From Supabase Dashboard
SUPABASE_ANON_KEY=           # From Supabase Dashboard
SUPABASE_SERVICE_ROLE_KEY=   # For file uploads (bypasses RLS)
```

### **Database Setup**
```bash
# Generate and apply migrations
pnpm db:generate
pnpm db:push

# Open database explorer
pnpm db:studio
```

### **Supabase Configuration**
1. **Enable pgvector**: Install the extension in your Supabase project
2. **Create Storage Bucket**: Named `pemast-files` with private access
3. **Service Role**: Use service role key for file operations

---

## 🚀 Development

### **Start Development Server**
```bash
pnpm dev              # Start with hot reload
```

### **Available Scripts**
```bash
pnpm build            # Build for production
pnpm start            # Run production build
pnpm lint             # Biome code checking
pnpm format           # Code formatting
pnpm test             # Run tests
pnpm db:generate      # Generate DB migrations
pnpm db:push          # Apply migrations to database
pnpm db:studio        # Open Drizzle Studio
```

### **Architecture Principles**
1. **Dependency Injection**: Services injected into constructors
2. **Platform Agnostic**: Core logic independent of Telegram
3. **Type Safety**: Full TypeScript with strict mode
4. **Single Source of Truth**: All types derived from database schema
5. **Clean Separation**: Gateway → Core → Services → Database
6. **Modular Design**: Composable utilities and reusable components

---

## 📊 Performance & Costs

### **OpenAI API Usage (Estimated for ~10 users)**
| Service | Volume | Monthly Cost |
|---------|--------|--------------|
| Embeddings (text-embedding-3-small) | ~2M tokens | $0.20 |
| Whisper Transcription | ~10 hours | $0.60 |
| GPT-4 Turbo (agent + processing) | ~1M tokens | $2.00 |
| **Total** | | **≈ $2.80/month** |

### **Supabase Resources**
- **Database**: Free tier (up to 500MB)
- **Storage**: Free tier (up to 1GB)
- **Vector Operations**: Included in PostgreSQL
- **Edge Functions**: Free tier (up to 100K invocations)

---

## 🎯 Roadmap

### **Phase 1: Core Completion** (Current)
- ✅ Message-Memory-File integration
- ✅ Semantic search with embeddings  
- ✅ Smart memory deduplication
- ✅ AI agent with tool system
- ✅ Modular prompt system and user preferences
- 🔄 Document processor implementation
- 🔄 Facts management system testing

### **Phase 2: Enhanced Features**
- Multi-threaded conversations
- Advanced reminder system with smart scheduling
- Cross-reference fact detection
- Memory categorization improvements
- Performance optimization for large datasets
- Advanced preference system (themes, custom behaviors)

### **Phase 3: Multi-Platform**
- Slack gateway implementation
- Discord integration
- WhatsApp Business API support
- REST API for external integrations
- Web interface for memory management

### **Phase 4: Advanced Intelligence**
- Proactive memory suggestions
- Context-aware reminder scheduling
- Automatic fact extraction from conversations
- Advanced analytics and insights
- Enterprise features (team memories, shared knowledge)

---

## 🏆 Design Philosophy

### **Core Principles**
1. **Memory-First Design**: Every interaction contributes to growing knowledge
2. **Semantic Understanding**: AI processes meaning, not just keywords
3. **Progressive Enhancement**: Start simple, add intelligence over time
4. **Platform Independence**: Business logic works anywhere
5. **Type Safety**: Catch errors at compile time, not runtime
6. **Clean Architecture**: Easy to test, extend, and maintain
7. **Modular Composition**: Reusable utilities and composable components

### **AI Integration Standards**
- **Structured Outputs**: All OpenAI calls use Zod schemas
- **Error Resilience**: Graceful degradation when services fail
- **Context Awareness**: Personal memories enhance every interaction
- **Tool Composition**: Agent capabilities grow through tool additions
- **Personalization**: User preferences shape AI behavior and responses

### **Code Quality Standards**
- **Build Small, Grow On Demand**: Start with minimal implementations
- **No Duplication**: Extract abstractions only when pain is felt twice
- **String Builder Pattern**: Conditional composition over complex concatenation
- **Functional Approach**: Prefer pure functions and immutable patterns
- **Type-First Development**: Types guide implementation and catch errors early

---

*Built with modern TypeScript practices, clean architecture principles, and AI-first design.*
