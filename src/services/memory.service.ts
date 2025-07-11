import { eq, and, desc, or, ilike, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { memories } from '../db/schema.js';
import { embeddingService } from './embedding.service.js';
import type { 
  CreateMemoryInput, 
  DatabaseContext, 
  Memory,
  VectorSearchResult,
  MemoryWithRelations 
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

      // For now, return empty results until OpenAI embedding integration is complete
      // TODO: Implement actual vector search when embeddings are working
      console.log('Vector search not yet implemented - falling back to text search');
      const textResults = await this.searchMemoriesByText(query, userId, projectId, limit);
      
      return textResults.map(item => ({
        item,
        similarity: 0.8, // Mock similarity score
        distance: 0.2
      }));

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
      return await db.query.memories.findMany({
        where: and(
          eq(memories.userId, userId),
          eq(memories.projectId, projectId),
          sql`${memories.tags} && ${tags}` // Array overlap operator
        ),
        orderBy: desc(memories.createdAt),
        limit,
      });
    } catch (error) {
      console.error('Error searching memories by tags:', error);
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

      // Extract potential tags from query
      const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
      
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
      
      if (searchMethods.includes('tags')) {
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
        if (result.similarity > 0.7) { // Only high-confidence semantic matches
          allMemories.set(result.item.id, result.item);
        }
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
        combined: results.combined.length
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
} 