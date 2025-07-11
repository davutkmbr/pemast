# EmbeddingService with OpenAI Integration

## 🚀 Setup Guide

### 1. Install Dependencies

```bash
# Add OpenAI package
pnpm add openai

# Make sure you have the correct version
pnpm list openai
```

### 2. Environment Variables

Create or update your `.env.local` file:

```bash
# Required for embeddings
OPENAI_API_KEY=your-openai-api-key-here

# Optional: Database and other services
DATABASE_URL=your-database-url
TELEGRAM_BOT_TOKEN=your-telegram-token
```

### 3. Basic Usage

```typescript
import { embeddingService } from './services/embedding.service.js';

// Check if embeddings are enabled
console.log('Embeddings enabled:', embeddingService.isEmbeddingEnabled());

// Generate single embedding
const embedding = await embeddingService.generateEmbedding("Fettah benim arkadaşım");

// Generate batch embeddings
const embeddings = await embeddingService.batchGenerateEmbeddings([
  "Text 1", "Text 2", "Text 3"
]);

// Use text preprocessing
const clean = embeddingService.prepareTextForEmbedding("  messy  text  ");

// Combine fields for embedding
const combined = embeddingService.combineFieldsForEmbedding([
  "content", "summary", "tag1", "tag2"
]);
```

### 4. Service Integration

The embedding service is now automatically used by:

- **MemoryService** - For semantic memory search
- **ReminderService** - For semantic reminder search  
- **Future services** - FactsService, etc.

No code changes needed in existing services - they automatically benefit from real embeddings!

### 5. Configuration

```typescript
// Check current config
const config = embeddingService.getConfig();
console.log(config);
// Output: { model: 'text-embedding-3-small', dimensions: 1536, isEnabled: true, ... }

// Update config if needed
embeddingService.updateConfig({
  model: 'text-embedding-3-large',
  dimensions: 3072,
  maxRetries: 5
});
```

### 6. Error Handling

The service gracefully handles errors:

- **No API key** → Returns empty embeddings, logs warning
- **Rate limits** → Automatic retry with exponential backoff
- **Token limits** → Automatic text truncation
- **Network errors** → Graceful fallback to empty embeddings

### 7. Testing

```typescript
import { testEmbeddingService } from './services/embedding.service.test.js';

// Run comprehensive tests
await testEmbeddingService();
```

### 8. Performance Tips

**Batch Processing:**
```typescript
// ✅ Good - Use batch API for multiple texts
const embeddings = await embeddingService.batchGenerateEmbeddings(manyTexts);

// ❌ Avoid - Individual calls for multiple texts
for (const text of manyTexts) {
  await embeddingService.generateEmbedding(text); // Slow!
}
```

**Text Preparation:**
```typescript
// ✅ Good - Text is automatically prepared
const embedding = await embeddingService.generateEmbedding(messyText);

// ✅ Also good - Manual preparation for special cases
const clean = embeddingService.prepareTextForEmbedding(messyText, {
  maxLength: 8000,
  removeExtraSpaces: true
});
```

### 9. Monitoring

```typescript
// Health check
const health = await embeddingService.testEmbedding();
if (health.success) {
  console.log(`✅ Embeddings working! Dimensions: ${health.dimensions}`);
} else {
  console.error(`❌ Embedding error: ${health.error}`);
}
```

## 🎯 Real World Examples

### Memory Service Usage
```typescript
// User: "Fettah benim arkadaşım, çok güvenilir"
// System automatically creates embedding for semantic search

const memory = await memoryService.createMemory({
  content: "Fettah benim arkadaşım, çok güvenilir",
  summary: "Fettah hakkında",
  tags: ['fettah', 'arkadaş'],
  messageId: 'msg-123'
}, context);

// Later: User asks "Fettah'la ilgili ne söylemiştim?"
// System finds memory using semantic similarity
const results = await memoryService.findMemories("Fettah", userId, projectId);
```

### Reminder Service Usage
```typescript
// User: "Fettah'ın doğum günü 28 Mayıs, hatırlat"
// System creates reminder with embedding

const reminder = await reminderService.createReminder({
  content: "Fettah'ın doğum günü",
  summary: "Doğum günü hatırlatıcısı", 
  tags: ['fettah', 'doğum günü'],
  scheduledFor: new Date('2024-05-28'),
  messageId: 'msg-456'
}, context);

// Later: User asks "Fettah'ın doğum günü hatırlatıcısını sil"
// System finds reminder using semantic search
const reminders = await reminderService.findReminders("Fettah doğum günü", userId, projectId);
```

## 🛠️ Troubleshooting

### Common Issues

**1. "OpenAI not initialized"**
```bash
# Check environment variable
echo $OPENAI_API_KEY

# Set if missing
export OPENAI_API_KEY="your-key-here"
```

**2. "Rate limit exceeded"**
```typescript
// Use retry mechanism
const embedding = await embeddingService.generateEmbeddingWithRetry(text);

// Or adjust config
embeddingService.updateConfig({
  maxRetries: 5,
  retryDelay: 2000
});
```

**3. "Token limit exceeded"**
```typescript
// Text is automatically truncated, but you can control it
const clean = embeddingService.prepareTextForEmbedding(longText, {
  maxLength: 8000 // Approximate token limit
});
```

### Logs to Watch

```
✅ OpenAI client initialized for embeddings
✅ Generated embedding with 1536 dimensions  
⚠️ Text truncated to 8192 characters for embedding
❌ Rate limit hit - consider using retry logic
```

## 🔮 Next Steps

With embeddings working, you can now:

1. **Test semantic search** - Upload documents, ask questions
2. **Build FactsService** - Semantic fact storage and retrieval
3. **Implement vector search** - PostgreSQL pgvector integration
4. **Create AI agent** - Combine all services for intelligent responses 