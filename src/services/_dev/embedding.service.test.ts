// Simple test/example for EmbeddingService with OpenAI integration
import { embeddingService } from '../embedding.service.js';

async function testEmbeddingService() {
  console.log('🧪 Testing EmbeddingService with OpenAI integration\n');

  // Check configuration
  const config = embeddingService.getConfig();
  console.log('Configuration:', config);
  console.log('Embeddings enabled:', config.isEnabled);
  console.log('Has API key:', config.hasApiKey);
  console.log('');

  if (!config.isEnabled) {
    console.log('⚠️ Embeddings not enabled. Set OPENAI_API_KEY environment variable.');
    console.log('Example: export OPENAI_API_KEY="your-api-key-here"');
    return;
  }

  // Test 1: Simple embedding generation
  console.log('=== Test 1: Simple Embedding Generation ===');
  try {
    const testText = "Fettah benim en iyi arkadaşım ve doğum günü 28 Mayıs";
    console.log(`Input text: "${testText}"`);
    
    const embedding = await embeddingService.generateEmbedding(testText);
    
    if (embedding.length > 0) {
      console.log(`✅ Success! Generated embedding with ${embedding.length} dimensions`);
      console.log(`First 5 values: [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
    } else {
      console.log('❌ Failed to generate embedding');
    }
  } catch (error) {
    console.error('❌ Error in test 1:', error);
  }
  console.log('');

  // Test 2: Text preprocessing
  console.log('=== Test 2: Text Preprocessing ===');
  const messyText = "   Fettah    arkadaş   doğum günü    28 MAYIS!!!   ";
  console.log(`Original: "${messyText}"`);
  
  const cleaned = embeddingService.prepareTextForEmbedding(messyText, {
    removeExtraSpaces: true,
    toLowerCase: false,
    maxLength: 100
  });
  console.log(`Cleaned: "${cleaned}"`);
  console.log('');

  // Test 3: Field combination
  console.log('=== Test 3: Field Combination ===');
  const fields = [
    "Fettah doğum günü",
    "28 Mayıs", 
    "arkadaş",
    null,
    "",
    "parti"
  ];
  console.log('Input fields:', fields);
  
  const combined = embeddingService.combineFieldsForEmbedding(fields);
  console.log(`Combined and cleaned: "${combined}"`);
  console.log('');

  // Test 4: Batch embedding generation
  console.log('=== Test 4: Batch Embedding Generation ===');
  try {
    const texts = [
      "Fettah benim arkadaşım",
      "Mali rapor Q4 2023",
      "Authentication sistemi revizyonu"
    ];
    console.log('Input texts:', texts);
    
    const embeddings = await embeddingService.batchGenerateEmbeddings(texts);
    
    if (embeddings.length > 0) {
      console.log(`✅ Success! Generated ${embeddings.length} embeddings`);
      embeddings.forEach((emb, i) => {
        console.log(`  Text ${i + 1}: ${emb.length} dimensions`);
      });
    } else {
      console.log('❌ Failed to generate batch embeddings');
    }
  } catch (error) {
    console.error('❌ Error in test 4:', error);
  }
  console.log('');

  // Test 5: Retry mechanism
  console.log('=== Test 5: Retry Mechanism ===');
  try {
    const retryText = "Test text for retry mechanism";
    console.log(`Input: "${retryText}"`);
    
    const embedding = await embeddingService.generateEmbeddingWithRetry(retryText);
    
    if (embedding.length > 0) {
      console.log(`✅ Success with retry! ${embedding.length} dimensions`);
    } else {
      console.log('❌ Failed even with retry');
    }
  } catch (error) {
    console.error('❌ Error in test 5:', error);
  }
  console.log('');

  // Test 6: Service health check
  console.log('=== Test 6: Service Health Check ===');
  try {
    const healthCheck = await embeddingService.testEmbedding();
    
    if (healthCheck.success) {
      console.log(`✅ Service is healthy! Dimensions: ${healthCheck.dimensions}`);
    } else {
      console.log(`❌ Service health check failed: ${healthCheck.error}`);
    }
  } catch (error) {
    console.error('❌ Error in health check:', error);
  }
  console.log('');

  // Test 7: Memory Service integration example
  console.log('=== Test 7: Memory Service Integration Example ===');
  try {
    // Simulate how MemoryService would use this
    const memoryContent = "Fettah benim en yakın arkadaşım. 15 yıldır tanıyorum. Çok güvenilir biri.";
    const memorySummary = "Fettah hakkında kişisel bilgiler";
    const memoryTags = ['fettah', 'arkadaş', 'kişisel', 'güvenilir'];

    // This is exactly how MemoryService combines fields
    const searchText = embeddingService.combineFieldsForEmbedding([
      memoryContent,
      memorySummary,
      ...memoryTags
    ]);

    console.log(`Memory search text: "${searchText}"`);
    
    const memoryEmbedding = await embeddingService.generateEmbedding(searchText);
    
    if (memoryEmbedding.length > 0) {
      console.log(`✅ Memory embedding generated: ${memoryEmbedding.length} dimensions`);
    } else {
      console.log('❌ Failed to generate memory embedding');
    }
  } catch (error) {
    console.error('❌ Error in memory integration test:', error);
  }
  console.log('');

  console.log('🏁 All tests completed!');
}

// Export for use in other files
export { testEmbeddingService }; 