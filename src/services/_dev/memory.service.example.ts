// Example usage of MemoryService
import { MemoryService } from '../memory.service.js';
import type { CreateMemoryInput, DatabaseContext } from '../../types/index.js';

async function exampleUsage() {
  const memoryService = new MemoryService();
  
  // Database context (would come from user/message context)
  const context: DatabaseContext = {
    projectId: 'project-123',
    userId: 'user-456', 
    channelId: 'channel-789'
  };

  // Example 1: Personal information memory
  const personalMemory: CreateMemoryInput = {
    content: "Fettah benim en yakın arkadaşım. 15 yıldır tanıyorum. Çok güvenilir biri, her zaman yanımda.",
    summary: "Fettah hakkında kişisel bilgiler - yakın arkadaş",
    messageId: 'msg-1',
    tags: ['fettah', 'arkadaş', 'kişisel', 'güvenilir'],
    metadata: {
      category: 'personal',
      relationship: 'close_friend',
      importance: 'high'
    }
  };

  const personalId = await memoryService.createMemory(personalMemory, context);
  console.log('Created personal memory:', personalId);

  // Example 2: Work-related memory
  const workMemory: CreateMemoryInput = {
    content: "Proje toplantısında yeni özellik specleri konuştuk. Authentication system'i tamamen revize edilecek.",
    summary: "Proje toplantı notları - auth system revize",
    messageId: 'msg-2',
    tags: ['iş', 'toplantı', 'proje', 'authentication', 'özellik'],
    metadata: {
      category: 'work',
      project: 'main-app',
      priority: 'medium'
    }
  };

  const workId = await memoryService.createMemory(workMemory, context);
  console.log('Created work memory:', workId);

  // Example 3: File-based memory (document analysis)
  const documentMemory: CreateMemoryInput = {
    content: "Bu PDF'de şirketin Q4 2023 mali raporları var. Gelir %15 artmış, giderler kontrol altında.",
    summary: "Q4 2023 mali rapor özeti",
    messageId: 'msg-3',
    fileId: 'file-123', // PDF file reference
    tags: ['finans', 'rapor', 'Q4', '2023', 'gelir'],
    metadata: {
      category: 'business',
      document_type: 'financial_report',
      quarter: 'Q4_2023'
    }
  };

  const documentId = await memoryService.createMemory(documentMemory, context);
  console.log('Created document memory:', documentId);

  // Example 4: Photo-based memory
  const photoMemory: CreateMemoryInput = {
    content: "Fettah'ın doğum günü partisinde çekilmiş fotoğraf. Çok eğlenceli bir gece geçirdik, pasta çok lezzetliydi.",
    summary: "Fettah doğum günü parti fotoğrafı",
    messageId: 'msg-4',
    fileId: 'file-456', // Photo file reference
    tags: ['fettah', 'doğum günü', 'parti', 'fotoğraf', 'eğlence'],
    metadata: {
      category: 'social',
      event_type: 'birthday_party',
      people: ['fettah'],
      location: 'home'
    }
  };

  const photoId = await memoryService.createMemory(photoMemory, context);
  console.log('Created photo memory:', photoId);

  // SEARCH EXAMPLES - Different ways to find memories

  // Example 5: Semantic search for Fettah-related memories
  console.log('\n=== SEARCH EXAMPLES ===');
  
  const fettahSearch = await memoryService.findMemories(
    "Fettah arkadaş",
    context.userId,
    context.projectId,
    { limit: 3 }
  );
  console.log('Fettah memories found:', fettahSearch.combined.length);

  // Example 6: Work-related search
  const workSearch = await memoryService.searchMemoriesByTags(
    ['iş', 'proje'],
    context.userId,
    context.projectId
  );
  console.log('Work memories found:', workSearch.length);

  // Example 7: File-based memory search
  const fileMemories = await memoryService.getMemoriesByFile(
    'file-123',
    context.userId,
    context.projectId
  );
  console.log('Memories for file-123:', fileMemories.length);

  // Example 8: Text search
  const authSearch = await memoryService.searchMemoriesByText(
    "authentication",
    context.userId,
    context.projectId
  );
  console.log('Authentication-related memories:', authSearch.length);

  // Example 9: Get recent memories
  const recentMemories = await memoryService.getRecentMemories(
    context.userId,
    context.projectId,
    5
  );
  console.log('Recent memories:', recentMemories.length);

  // Example 10: Update a memory
  await memoryService.updateMemory(personalId, {
    summary: "Fettah - en yakın arkadaşım, 15 yıllık dostluk",
    tags: ['fettah', 'arkadaş', 'kişisel', 'güvenilir', 'uzun süreli dostluk']
  });
  console.log('Updated personal memory');

  // Example 11: Get memory statistics
  const stats = await memoryService.getMemoryStats(context.userId, context.projectId);
  console.log('Memory statistics:', stats);
}

// Example: AI/LLM usage scenarios
async function aiUsageScenarios() {
  const memoryService = new MemoryService();
  const userId = 'user-456';
  const projectId = 'project-123';

  console.log('\n=== AI/LLM USAGE SCENARIOS ===');

  // Scenario 1: User asks about someone they mentioned before
  // User: "Fettah'ın doğum günü ne zaman?"
  const fettahQuery = await memoryService.findMemories(
    "Fettah doğum günü",
    userId,
    projectId
  );
  console.log('AI found Fettah memories:', fettahQuery.combined.map(m => ({
    content: m.content.substring(0, 100) + '...',
    tags: m.tags
  })));

  // Scenario 2: User asks about work project
  // User: "Authentication projesinde neler konuşmuştuk?"
  const authQuery = await memoryService.findMemories(
    "authentication proje",
    userId,
    projectId
  );
  console.log('AI found auth project memories:', authQuery.combined.length);

  // Scenario 3: User asks about a document they uploaded
  // User: "Geçen yüklediğim mali raporda ne yazıyordu?"
  const financialQuery = await memoryService.findMemories(
    "mali rapor finans",
    userId,
    projectId,
    { searchMethods: ['text', 'tags'] }
  );
  console.log('AI found financial report memories:', financialQuery.combined.length);

  // Scenario 4: User wants to see everything about a topic
  // User: "Fettah ile ilgili ne tür anılarım var?"
  const allFettahMemories = await memoryService.searchMemoriesByTags(
    ['fettah'],
    userId,
    projectId
  );
  console.log('All Fettah-related memories:', allFettahMemories.map(m => ({
    type: m.fileId ? 'file-based' : 'text-based',
    summary: m.summary,
    tags: m.tags
  })));
}

// Example: Memory categories and organization
async function memoryOrganizationExample() {
  const memoryService = new MemoryService();
  const context: DatabaseContext = {
    projectId: 'project-123',
    userId: 'user-456', 
    channelId: 'channel-789'
  };

  console.log('\n=== MEMORY ORGANIZATION EXAMPLES ===');

  // Different types of memories with proper categorization
  const memoryTypes = [
    // Personal relationships
    {
      content: "Anneannem çok güzel yemek yapar, özellikle mantısı harika.",
      summary: "Anneanne - yemek yapma becerisi",
      tags: ['aile', 'anneanne', 'yemek', 'mantı'],
      category: 'family'
    },
    
    // Professional knowledge
    {
      content: "React hooks kullanırken useEffect'in dependency array'ini doğru vermek çok önemli.",
      summary: "React hooks - useEffect best practices",
      tags: ['programlama', 'react', 'hooks', 'useEffect'],
      category: 'technical'
    },
    
    // Places and experiences
    {
      content: "İstanbul'da Kapalıçarşı'da çok güzel bir antika dükkanı var, sahibi çok bilgili.",
      summary: "Kapalıçarşı antika dükkanı",
      tags: ['İstanbul', 'Kapalıçarşı', 'antika', 'alışveriş'],
      category: 'places'
    },
    
    // Health and habits
    {
      content: "Sabah kalktığımda 10 dakika meditasyon yapmak günüme çok iyi başlamamı sağlıyor.",
      summary: "Sabah meditasyon rutini",
      tags: ['sağlık', 'meditasyon', 'sabah rutini', 'yaşam tarzı'],
      category: 'lifestyle'
    }
  ];

  // Create different types of memories
  for (const memory of memoryTypes) {
    const memoryInput: CreateMemoryInput = {
      content: memory.content,
      summary: memory.summary,
      messageId: `msg-${Date.now()}-${Math.random()}`,
      tags: memory.tags,
      metadata: {
        category: memory.category,
        created_by: 'user',
        importance: 'medium'
      }
    };

    const memoryId = await memoryService.createMemory(memoryInput, context);
    console.log(`Created ${memory.category} memory:`, memoryId);
  }

  // Get statistics after creating memories
  const finalStats = await memoryService.getMemoryStats(context.userId, context.projectId);
  console.log('Final memory statistics:', finalStats);
}

// Example semantic search flow
/*
User Interaction Flow:

1. User: "Fettah benim arkadaşım. onu çok severim, doğum günü 28 mayıs."
   AI: Creates memory + reminder
   
2. User: "İş toplantısında authentication sistemini revize edeceğimizi konuştuk."
   AI: Creates work memory with technical tags
   
3. User uploads financial PDF
   AI: Analyzes file, creates memory with file reference
   
4. User: "Fettah'la ilgili ne anlatmıştım?"
   AI: Searches memories semantically and returns:
   - "Fettah benim arkadaşım..." (personal info)
   - "Fettah'ın doğum günü parti fotoğrafı" (photo memory)
   - Related birthday reminder
   
5. User: "Authentication projesi nasıl gidiyordu?"
   AI: Finds work memories about auth system
   
6. User: "Mali durumumuz nasıl?"
   AI: References uploaded financial report memory
*/

export { exampleUsage, aiUsageScenarios, memoryOrganizationExample }; 