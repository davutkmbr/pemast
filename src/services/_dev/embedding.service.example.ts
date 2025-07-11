// Example usage of EmbeddingService
import { EmbeddingService, embeddingService } from '../embedding.service.js';

async function basicUsageExamples() {
  console.log('=== BASIC EMBEDDING SERVICE USAGE ===');

  // Example 1: Single text embedding
  const simpleText = "Fettah benim en iyi arkadaşım";
  const embedding1 = await embeddingService.generateEmbedding(simpleText);
  console.log('Single embedding result:', embedding1.length > 0 ? `${embedding1.length} dimensions` : 'Empty (placeholder)');

  // Example 2: Batch embeddings
  const texts = [
    "Authentication sistemi revizyonu",
    "Mali rapor Q4 2023",
    "Doğum günü parti fotoğrafı"
  ];
  const batchEmbeddings = await embeddingService.batchGenerateEmbeddings(texts);
  console.log('Batch embedding results:', batchEmbeddings.length, 'embeddings generated');

  // Example 3: Text preprocessing
  const messyText = "   Fettah  arkadaş   doğum günü    ";
  const cleanText = embeddingService.prepareTextForEmbedding(messyText, {
    removeExtraSpaces: true,
    toLowerCase: true,
    maxLength: 100
  });
  console.log('Cleaned text:', `"${cleanText}"`);

  // Example 4: Combining fields
  const combinedText = embeddingService.combineFieldsForEmbedding([
    "Fettah doğum günü",
    "28 Mayıs",
    "arkadaş",
    null, // Will be filtered out
    "",   // Will be filtered out
    "parti"
  ]);
  console.log('Combined text:', `"${combinedText}"`);
}

async function memoryServiceIntegration() {
  console.log('\n=== MEMORY SERVICE INTEGRATION ===');

  // Example: How MemoryService uses EmbeddingService
  const memoryContent = "Fettah benim en yakın arkadaşım. 15 yıldır tanıyorum.";
  const memorySummary = "Fettah hakkında kişisel bilgiler";
  const memoryTags = ['fettah', 'arkadaş', 'kişisel'];

  // Combine fields for embedding (same as MemoryService does)
  const searchText = embeddingService.combineFieldsForEmbedding([
    memoryContent,
    memorySummary,
    ...memoryTags
  ]);

  console.log('Memory search text:', `"${searchText}"`);
  
  const embedding = await embeddingService.generateEmbedding(searchText);
  console.log('Memory embedding generated:', embedding.length > 0 ? 'Yes' : 'No (placeholder)');
}

async function reminderServiceIntegration() {
  console.log('\n=== REMINDER SERVICE INTEGRATION ===');

  // Example: How ReminderService uses EmbeddingService
  const reminderContent = "Fettah'ın doğum günü - tebrik et!";
  const reminderSummary = "Arkadaşım Fettah'ın doğum günü hatırlatıcısı";
  const reminderTags = ['fettah', 'arkadaş', 'doğum günü', 'birthday'];

  // Combine fields for embedding (same as ReminderService does)
  const searchText = embeddingService.combineFieldsForEmbedding([
    reminderContent,
    reminderSummary,
    ...reminderTags
  ]);

  console.log('Reminder search text:', `"${searchText}"`);
  
  const embedding = await embeddingService.generateEmbedding(searchText);
  console.log('Reminder embedding generated:', embedding.length > 0 ? 'Yes' : 'No (placeholder)');
}

async function advancedUsageExamples() {
  console.log('\n=== ADVANCED USAGE EXAMPLES ===');

  // Example 1: Custom configuration
  const customEmbeddingService = new EmbeddingService({
    model: 'text-embedding-3-large',
    dimensions: 3072,
    maxRetries: 5,
    retryDelay: 2000
  });

  console.log('Custom config:', customEmbeddingService.getConfig());

  // Example 2: Retry with fallback
  const embedding = await embeddingService.generateEmbeddingWithRetry(
    "Bu metin için embedding oluştur"
  );
  console.log('Retry embedding result:', embedding.length > 0 ? 'Success' : 'Failed/Placeholder');

  // Example 3: Check if embeddings are enabled
  const isEnabled = embeddingService.isEmbeddingEnabled();
  console.log('Embeddings enabled:', isEnabled);

  // Example 4: Update configuration
  embeddingService.updateConfig({
    maxRetries: 5,
    retryDelay: 1500
  });
  console.log('Updated config:', embeddingService.getConfig());
}

async function realWorldScenarios() {
  console.log('\n=== REAL WORLD SCENARIOS ===');

  // Scenario 1: User uploads a document
  const documentContent = "Bu PDF'de şirketin Q4 2023 mali raporları var. Gelir %15 artmış.";
  const documentSummary = "Q4 2023 mali rapor analizi";
  const documentTags = ['finans', 'rapor', 'Q4', '2023'];

  const docSearchText = embeddingService.combineFieldsForEmbedding([
    documentContent,
    documentSummary,
    ...documentTags
  ]);
  
  console.log('Document embedding text:', `"${docSearchText}"`);

  // Scenario 2: User asks a question
  const userQuery = "Mali rapor nasıldı?";
  const queryEmbedding = await embeddingService.generateEmbedding(userQuery);
  
  console.log('Query for search:', `"${userQuery}"`);
  console.log('Query embedding generated:', queryEmbedding.length > 0 ? 'Yes' : 'No');

  // Scenario 3: Batch processing multiple memories
  const memoryTexts = [
    "Anneannem çok güzel yemek yapar",
    "React hooks kullanırken dikkat etmek gerekiyor",
    "İstanbul'da güzel bir antika dükkanı buldum",
    "Sabah meditasyonu çok faydalı"
  ];

  console.log('Batch processing', memoryTexts.length, 'memory texts...');
  const batchResults = await embeddingService.batchGenerateEmbeddings(memoryTexts);
  console.log('Batch results:', batchResults.length, 'embeddings generated');
}

// Cross-service usage patterns
async function crossServicePatterns() {
  console.log('\n=== CROSS-SERVICE USAGE PATTERNS ===');

  // Pattern 1: Same embedding service across all services
  console.log('Embedding service instance:', embeddingService.constructor.name);
  console.log('Configuration shared across services:', embeddingService.getConfig());

  // Pattern 2: Consistent text preparation
  const textInputs = [
    "  Fettah doğum günü    ",
    "AUTHENTICATION PROJESİ",
    "mali rapor Q4 2023!!!",
    null,
    ""
  ];

  console.log('Original texts:', textInputs);
  
  const processedTexts = textInputs
    .filter(text => text) // Remove nulls
    .map(text => embeddingService.prepareTextForEmbedding(text!, {
      removeExtraSpaces: true,
      toLowerCase: true,
      maxLength: 200
    }));
  
  console.log('Processed texts:', processedTexts);

  // Pattern 3: Service-specific field combinations
  const reminderFields = ['content', 'summary', 'tag1', 'tag2'];
  const memoryFields = ['content', 'summary', 'tag1', 'tag2', 'metadata'];
  
  const reminderText = embeddingService.combineFieldsForEmbedding(reminderFields);
  const memoryText = embeddingService.combineFieldsForEmbedding(memoryFields, ' | ');
  
  console.log('Reminder embedding text:', `"${reminderText}"`);
  console.log('Memory embedding text:', `"${memoryText}"`);
}

// Performance considerations
async function performanceConsiderations() {
  console.log('\n=== PERFORMANCE CONSIDERATIONS ===');

  // Consideration 1: Batch vs individual calls
  const manyTexts = Array.from({ length: 10 }, (_, i) => `Text ${i + 1}`);
  
  console.time('Individual calls');
  for (const text of manyTexts) {
    await embeddingService.generateEmbedding(text);
  }
  console.timeEnd('Individual calls');
  
  console.time('Batch call');
  await embeddingService.batchGenerateEmbeddings(manyTexts);
  console.timeEnd('Batch call');

  // Consideration 2: Text length limits
  const longText = 'Very long text '.repeat(1000);
  const truncatedText = embeddingService.prepareTextForEmbedding(longText, {
    maxLength: 8192 // OpenAI's token limit approximation
  });
  
  console.log('Original length:', longText.length);
  console.log('Truncated length:', truncatedText.length);

  // Consideration 3: Empty text handling
  const emptyResults = await embeddingService.batchGenerateEmbeddings([
    '', '   ', null as any, undefined as any, 'Valid text'
  ]);
  
  console.log('Empty text handling results:', emptyResults.length, 'results');
}

export {
  basicUsageExamples,
  memoryServiceIntegration,
  reminderServiceIntegration,
  advancedUsageExamples,
  realWorldScenarios,
  crossServicePatterns,
  performanceConsiderations
}; 