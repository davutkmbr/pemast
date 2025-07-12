import { eq, and, desc, or, ilike, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { memories } from '../db/schema.js';
import { embeddingService } from './embedding.service.js';
import { vectorSearch } from '../utils/vector-search.js';
import type {
  CreateMemoryInput,
  DatabaseContext,
  Memory,
  VectorSearchResult,
  MemoryWithRelations,
  MemoryCategory
} from '../types/index.js';

/**
 * Service for managing episodic memories with semantic search capabilities
 */
export class MemoryService {

  /**
   * Create a new memory with semantic search support
   */
  async createMemory(
    input: CreateMemoryInput,
    context: DatabaseContext
  ): Promise<string> {
    try {
      // Generate embedding for semantic search using the generic service
      const searchText = embeddingService.combineFieldsForEmbedding([
        input.content,
        input.summary,
        ...(input.tags || [])
      ]);

      const embedding = await embeddingService.generateEmbedding(searchText);

      const [savedMemory] = await db.insert(memories).values({
        projectId: context.projectId,
        userId: context.userId,
        messageId: input.messageId,
        content: input.content,
        summary: input.summary,
        embedding: embedding.length > 0 ? embedding : null,
        fileId: input.fileId,
        metadata: input.metadata,
        tags: input.tags,
      }).returning({ id: memories.id });

      if (!savedMemory) {
        throw new Error('Failed to create memory - no result returned');
      }

      console.log('Created memory:', {
        id: savedMemory.id,
        content: input.content.substring(0, 100) + '...',
        summary: input.summary,
        tags: input.tags,
        hasFile: !!input.fileId,
        hasEmbedding: embedding.length > 0
      });

      return savedMemory.id;
    } catch (error) {
      console.error('Error creating memory:', error);
      throw new Error(`Failed to create memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get memory by ID with relations
   */
  async getMemoryById(memoryId: string): Promise<MemoryWithRelations | undefined> {
    try {
      const memory = await db.query.memories.findFirst({
        where: eq(memories.id, memoryId),
        with: {
          user: true,
          project: true,
          message: true,
          file: true,
        },
      });

      return memory as MemoryWithRelations | undefined;
    } catch (error) {
      console.error('Error fetching memory by ID:', error);
      throw new Error(`Failed to fetch memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent memories for a user
   */
  async getRecentMemories(
    userId: string,
    projectId: string,
    limit: number = 10
  ): Promise<MemoryWithRelations[]> {
    try {
      const recentMemories = await db.query.memories.findMany({
        where: and(
          eq(memories.userId, userId),
          eq(memories.projectId, projectId)
        ),
        orderBy: desc(memories.createdAt),
        limit,
        with: {
          user: true,
          project: true,
          message: true,
          file: true,
        },
      });

      return recentMemories as MemoryWithRelations[];
    } catch (error) {
      console.error('Error fetching recent memories:', error);
      throw new Error(`Failed to fetch recent memories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Semantic search for memories using embedding similarity
   */
  async searchMemoriesSemantic(
    query: string,
    userId: string,
    projectId: string,
    limit: number = 5
  ): Promise<VectorSearchResult<Memory>[]> {
    try {
      // Generate embedding for the search query
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      if (queryEmbedding.length === 0) {
        // Fallback to text search if embedding generation fails
        return this.searchMemoriesByText(query, userId, projectId, limit)
          .then(results => results.map(item => ({
            item,
            similarity: 0.5,
            distance: 0.5
          })));
      }

      // Use generic vector search helper
      const vectorResults = await vectorSearch<Memory>({
        table: memories,
        embeddingColumn: memories.embedding,
        selectColumns: {
          id: memories.id,
          projectId: memories.projectId,
          userId: memories.userId,
          messageId: memories.messageId,
          content: memories.content,
          summary: memories.summary,
          embedding: memories.embedding,
          fileId: memories.fileId,
          metadata: memories.metadata,
          tags: memories.tags,
          createdAt: memories.createdAt,
          updatedAt: memories.updatedAt,
        },
        where: [
          eq(memories.userId, userId),
          eq(memories.projectId, projectId),
        ],
        queryEmbedding,
        limit,
      });

      return vectorResults;

    } catch (error) {
      console.error('Error in semantic memory search:', error);
      throw new Error(`Failed to search memories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search memories by text content (fuzzy search)
   */
  async searchMemoriesByText(
    query: string,
    userId: string,
    projectId: string,
    limit: number = 10
  ): Promise<Memory[]> {
    try {
      const searchTerm = `%${query.toLowerCase()}%`;

      return await db.query.memories.findMany({
        where: and(
          eq(memories.userId, userId),
          eq(memories.projectId, projectId),
          or(
            ilike(memories.content, searchTerm),
            ilike(memories.summary, searchTerm)
          )
        ),
        orderBy: desc(memories.createdAt),
        limit,
      });
    } catch (error) {
      console.error('Error searching memories by text:', error);
      throw new Error(`Failed to search memories by text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search memories by tags
   */
  async searchMemoriesByTags(
    tags: string[],
    userId: string,
    projectId: string,
    limit: number = 10
  ): Promise<Memory[]> {
    try {
      // If no tags provided, return empty array
      if (!tags || tags.length === 0) {
        return [];
      }

      // Filter and clean tags
      const cleanTags = tags
        .filter(tag => tag && tag.trim().length > 0) // Remove empty/null tags
        .map(tag => tag.trim()) // Remove whitespace
        .filter(tag => tag.length > 1) // Remove single character tags
        .map(tag => {
          // Remove problematic characters and escape quotes
          return tag
            .replace(/[.,:;!?()[\]{}]/g, '') // Remove punctuation
            .replace(/'/g, "''") // Escape single quotes for PostgreSQL
            .toLowerCase();
        })
        .filter(tag => tag.length > 0) // Remove empty tags after cleaning
        .slice(0, 20); // Limit to prevent overly long arrays

      // If no valid tags after filtering, return empty array
      if (cleanTags.length === 0) {
        return [];
      }

      // Build PostgreSQL array literal with proper quoting
      // Each tag needs to be quoted to handle spaces and special chars
      const quotedTags = cleanTags.map(tag => `"${tag}"`);
      const tagsArray = `{${quotedTags.join(',')}}`;

      console.log('Searching with cleaned tags:', cleanTags);

      return await db.query.memories.findMany({
        where: and(
          eq(memories.userId, userId),
          eq(memories.projectId, projectId),
          sql`${memories.tags} && ${tagsArray}::text[]` // Array overlap operator with explicit cast
        ),
        orderBy: desc(memories.createdAt),
        limit,
      });
    } catch (error) {
      console.error('Error searching memories by tags:', error);
      console.error('Failed tags array:', tags);
      throw new Error(`Failed to search memories by tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get memories associated with a specific file
   */
  async getMemoriesByFile(
    fileId: string,
    userId: string,
    projectId: string
  ): Promise<Memory[]> {
    try {
      return await db.query.memories.findMany({
        where: and(
          eq(memories.fileId, fileId),
          eq(memories.userId, userId),
          eq(memories.projectId, projectId)
        ),
        orderBy: desc(memories.createdAt),
      });
    } catch (error) {
      console.error('Error fetching memories by file:', error);
      throw new Error(`Failed to fetch memories by file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get memories from a specific message (useful for context)
   */
  async getMemoriesByMessage(messageId: string): Promise<Memory[]> {
    try {
      return await db.query.memories.findMany({
        where: eq(memories.messageId, messageId),
        orderBy: desc(memories.createdAt),
      });
    } catch (error) {
      console.error('Error fetching memories by message:', error);
      throw new Error(`Failed to fetch memories by message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Combined search - finds memories by content, tags, or semantic similarity
   * This is the main search method that should be used by the AI/LLM
   */
  async findMemories(
    query: string,
    userId: string,
    projectId: string,
    options?: {
      limit?: number;
      searchMethods?: ('semantic' | 'text' | 'tags')[];
      includeFileMemories?: boolean;
    }
  ): Promise<{
    semantic: VectorSearchResult<Memory>[];
    text: Memory[];
    tags: Memory[];
    combined: Memory[];
  }> {
    const limit = options?.limit || 5;
    const searchMethods = options?.searchMethods || ['semantic', 'text', 'tags'];

    try {
      const results = {
        semantic: [] as VectorSearchResult<Memory>[],
        text: [] as Memory[],
        tags: [] as Memory[],
        combined: [] as Memory[]
      };

      // Extract potential tag-like words from query (only meaningful categories/keywords)
      const queryWords = query.toLowerCase()
        .split(' ')
        .filter(word => word.length > 2)
        .filter(word => {
          // Only include words that look like meaningful tags
          // Skip common articles, prepositions, and generic words
          const skipWords = ['the', 'and', 'but', 'for', 'with', 'from', 'that', 'this', 'than', 'more', 'less', 'even', 'also', 'very', 'much', 'many', 'some', 'all', 'any', 'his', 'her', 'him', 'she', 'they', 'them', 'their', 'was', 'were', 'are', 'is', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'cant', 'wont', 'dont', 'doesnt', 'didnt', 'hasnt', 'havent', 'isnt', 'arent', 'wasnt', 'werent', 'although', 'because', 'since', 'when', 'where', 'what', 'why', 'how', 'who', 'which', 'while', 'during', 'before', 'after', 'above', 'below', 'over', 'under', 'through', 'between', 'among', 'within', 'without', 'against', 'toward', 'towards', 'upon', 'onto', 'into', 'unto', 'about', 'around', 'across', 'along', 'beside', 'beyond', 'behind', 'beneath', 'inside', 'outside', 'instead', 'except', 'besides', 'including', 'regarding', 'concerning', 'considering', 'despite', 'unless', 'until', 'whether', 'however', 'therefore', 'moreover', 'furthermore', 'nevertheless', 'nonetheless', 'otherwise', 'meanwhile', 'likewise', 'similarly', 'consequently', 'accordingly', 'indeed', 'certainly', 'obviously', 'apparently', 'perhaps', 'probably', 'possibly', 'definitely', 'absolutely', 'completely', 'entirely', 'exactly', 'precisely', 'specifically', 'particularly', 'especially', 'generally', 'usually', 'normally', 'typically', 'commonly', 'frequently', 'regularly', 'occasionally', 'sometimes', 'rarely', 'seldom', 'never', 'always', 'often', 'usually'];
          
          return !skipWords.includes(word);
        })
        .slice(0, 5); // Limit to prevent too many tag searches

      // Parallel search execution
      const searches = [];

      if (searchMethods.includes('semantic')) {
        searches.push(
          this.searchMemoriesSemantic(query, userId, projectId, limit)
            .then(res => { results.semantic = res; })
            .catch(err => console.error('Semantic search failed:', err))
        );
      }

      if (searchMethods.includes('text')) {
        searches.push(
          this.searchMemoriesByText(query, userId, projectId, limit)
            .then(res => { results.text = res; })
            .catch(err => console.error('Text search failed:', err))
        );
      }

      if (searchMethods.includes('tags') && queryWords.length > 0) {
        searches.push(
          this.searchMemoriesByTags(queryWords, userId, projectId, limit)
            .then(res => { results.tags = res; })
            .catch(err => console.error('Tag search failed:', err))
        );
      }

      // Wait for all searches to complete
      await Promise.all(searches);

      // Combine and deduplicate results
      const allMemories = new Map<string, Memory>();

      // Add semantic results (highest priority)
      results.semantic.forEach(result => {
        allMemories.set(result.item.id, result.item);
      });

      // Add text search results
      results.text.forEach(memory => {
        allMemories.set(memory.id, memory);
      });

      // Add tag search results
      results.tags.forEach(memory => {
        allMemories.set(memory.id, memory);
      });

      results.combined = Array.from(allMemories.values())
        .sort((a, b) => {
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bDate - aDate;
        })
        .slice(0, limit);

      console.log(`Found memories for "${query}":`, {
        semantic: results.semantic.length,
        text: results.text.length,
        tags: results.tags.length,
        combined: results.combined.length,
        tagWords: queryWords,
      });

      return results;

    } catch (error) {
      console.error('Error in combined memory search:', error);
      throw new Error(`Failed to find memories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a memory's content, summary, or tags
   */
  async updateMemory(
    memoryId: string,
    updates: {
      content?: string;
      summary?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Generate new embedding if content or summary changed
      let embedding: number[] | null = null;
      if (updates.content || updates.summary) {
        const currentMemory = await this.getMemoryById(memoryId);
        if (currentMemory) {
          const searchText = embeddingService.combineFieldsForEmbedding([
            updates.content || currentMemory.content,
            updates.summary || currentMemory.summary || '',
            ...(updates.tags || currentMemory.tags || [])
          ]);

          embedding = await embeddingService.generateEmbedding(searchText);
        }
      }

      const updateData: any = {
        ...updates,
        updatedAt: new Date()
      };

      if (embedding && embedding.length > 0) {
        updateData.embedding = embedding;
      }

      await db.update(memories)
        .set(updateData)
        .where(eq(memories.id, memoryId));

      console.log('Updated memory:', memoryId);
    } catch (error) {
      console.error('Error updating memory:', error);
      throw new Error(`Failed to update memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId: string): Promise<void> {
    try {
      await db.delete(memories).where(eq(memories.id, memoryId));
      console.log('Deleted memory:', memoryId);
    } catch (error) {
      console.error('Error deleting memory:', error);
      throw new Error(`Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get memory statistics for a user
   */
  async getMemoryStats(userId: string, projectId: string): Promise<{
    totalMemories: number;
    memoriesWithFiles: number;
    memoriesWithTags: number;
    topTags: { tag: string; count: number }[];
  }> {
    try {
      const userMemories = await db.query.memories.findMany({
        where: and(
          eq(memories.userId, userId),
          eq(memories.projectId, projectId)
        ),
      });

      const totalMemories = userMemories.length;
      const memoriesWithFiles = userMemories.filter(m => m.fileId).length;
      const memoriesWithTags = userMemories.filter(m => m.tags && m.tags.length > 0).length;

      // Calculate top tags
      const tagCounts = new Map<string, number>();
      userMemories.forEach(memory => {
        if (memory.tags) {
          memory.tags.forEach(tag => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        }
      });

      const topTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalMemories,
        memoriesWithFiles,
        memoriesWithTags,
        topTags
      };
    } catch (error) {
      console.error('Error getting memory stats:', error);
      throw new Error(`Failed to get memory stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get personal context for a user - key personal information to include in conversations
   * Retrieves memories with personal categories: personal_info, contact, location, preference, etc.
   */
  async getPersonalContext(
    userId: string,
    projectId: string,
    limit: number = 15
  ): Promise<Memory[]> {
    try {
      // Personal information categories to retrieve
      const personalCategories: MemoryCategory[] = [
        'personal_info',   // Name, age, occupation, etc.
        'contact',         // Email, phone, addresses
        'location',        // Where they live/work
        'preference',      // Important preferences
        'work',           // Current job, role, company
        'family',         // Family information
        'goal',           // Important goals/objectives
        'skill',          // Key skills they've mentioned
      ];

      // Convert JavaScript array to PostgreSQL array literal format
      const personalCategoriesArray = `{${personalCategories.join(',')}}`;

      const personalMemories = await db.query.memories.findMany({
        where: and(
          eq(memories.userId, userId),
          eq(memories.projectId, projectId),
          sql`${memories.tags} && ${personalCategoriesArray}::text[]` // Array overlap with explicit cast
        ),
        orderBy: desc(memories.createdAt),
        limit,
      });

      console.log(`Retrieved ${personalMemories.length} personal context memories for user ${userId}`);
      return personalMemories;
    } catch (error) {
      console.error('Error fetching personal context:', error);
      throw new Error(`Failed to fetch personal context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format personal context for inclusion in conversation prompts
   * Returns a concise summary of key personal information
   */
  formatPersonalContextForPrompt(personalMemories: Memory[]): string {
    if (personalMemories.length === 0) {
      return 'No personal information available about this user yet.';
    }

    const sections = new Map<string, string[]>();

    personalMemories.forEach(memory => {
      const tags = memory.tags || [];
      const content = memory.summary || memory.content;

      // Categorize by primary tag
      if (tags.includes('personal_info')) {
        if (!sections.has('Personal Info')) sections.set('Personal Info', []);
        sections.get('Personal Info')!.push(content);
      } else if (tags.includes('work')) {
        if (!sections.has('Work')) sections.set('Work', []);
        sections.get('Work')!.push(content);
      } else if (tags.includes('location')) {
        if (!sections.has('Location')) sections.set('Location', []);
        sections.get('Location')!.push(content);
      } else if (tags.includes('preference')) {
        if (!sections.has('Preferences')) sections.set('Preferences', []);
        sections.get('Preferences')!.push(content);
      } else if (tags.includes('contact')) {
        if (!sections.has('Contact')) sections.set('Contact', []);
        sections.get('Contact')!.push(content);
      } else if (tags.includes('family')) {
        if (!sections.has('Family')) sections.set('Family', []);
        sections.get('Family')!.push(content);
      } else if (tags.includes('goal')) {
        if (!sections.has('Goals')) sections.set('Goals', []);
        sections.get('Goals')!.push(content);
      } else if (tags.includes('skill')) {
        if (!sections.has('Skills')) sections.set('Skills', []);
        sections.get('Skills')!.push(content);
      }
    });

    // Build formatted context
    const contextParts: string[] = [];
    contextParts.push('=== USER PERSONAL CONTEXT ===');

    sections.forEach((items, category) => {
      if (items.length > 0) {
        contextParts.push(`\n${category}:`);
        items.forEach(item => {
          contextParts.push(`- ${item}`);
        });
      }
    });

    contextParts.push('\n=== END PERSONAL CONTEXT ===');

    return contextParts.join('\n');
  }
}

export const memoryService = new MemoryService();