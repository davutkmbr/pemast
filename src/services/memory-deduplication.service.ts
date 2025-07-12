import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { MemoryService } from './memory.service.js';
import type { 
  CreateMemoryInput, 
  DatabaseContext, 
  Memory,
} from '../types/index.js';

/**
 * Service for smart memory deduplication and management
 * Prevents duplicate memories by checking similarity and deciding between create/update
 */
export class MemoryDeduplicationService {
  private memoryService: MemoryService;
  private openai: OpenAI;

  constructor() {
    this.memoryService = new MemoryService();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Smart memory creation with deduplication
   * Searches for similar memories and decides whether to create new or update existing
   */
  async smartCreateMemory(
    input: CreateMemoryInput,
    context: DatabaseContext
  ): Promise<{
    action: 'created' | 'updated' | 'skipped';
    memoryId: string;
    reason: string;
    similarMemories?: Memory[];
  }> {
    try {
      console.log('🔍 Starting smart memory creation for:', input.content.substring(0, 100) + '...');

      // Step 1: Search for similar memories
      const searchQuery = this.buildSearchQuery(input);
      const searchResults = await this.memoryService.findMemories(
        searchQuery,
        context.userId,
        context.projectId,
        { 
          limit: 10,
          searchMethods: ['semantic', 'text', 'tags']
        }
      );

      if (searchResults.combined.length === 0) {
        // No similar memories found, create new one
        const memoryId = await this.memoryService.createMemory(input, context);
        return {
          action: 'created',
          memoryId,
          reason: 'No similar memories found',
        };
      }

      // Step 2: Use AI agent to analyze similarity and decide action
      const userContext = {
        userId: context.userId,
      };
      
      const decision = await this.analyzeMemorySimilarity(input, searchResults.combined, userContext);

      // Step 3: Execute the decided action
      return await this.executeMemoryAction(input, context, decision, searchResults.combined);

    } catch (error) {
      console.error('Error in smart memory creation:', error);
      // Fallback to regular creation
      const memoryId = await this.memoryService.createMemory(input, context);
      return {
        action: 'created',
        memoryId,
        reason: `Fallback creation due to error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Build search query from memory input
   */
  private buildSearchQuery(input: CreateMemoryInput): string {
    const parts: string[] = [];
    
    if (input.content) {
      // Extract key words from content (first 200 chars)
      const contentWords = input.content
        .substring(0, 200)
        .split(' ')
        .filter(word => word.length > 3)
        .slice(0, 10);
      parts.push(...contentWords);
    }
    
    if (input.summary) {
      parts.push(input.summary);
    }
    
    if (input.tags && input.tags.length > 0) {
      parts.push(...input.tags);
    }
    
    return parts.join(' ');
  }

  /**
   * AI agent analyzes memory similarity and decides action
   */
  private async analyzeMemorySimilarity(
    newMemory: CreateMemoryInput,
    existingMemories: Memory[],
    userContext?: {
      userId: string;
      userName?: string;
    }
  ): Promise<MemoryDecision> {
    const prompt = this.buildAnalysisPrompt(newMemory, existingMemories, userContext);

    try {
      const response = await this.openai.chat.completions.parse({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are a memory deduplication expert. Analyze whether a new memory is similar enough to existing ones to warrant updating instead of creating new entries.

CRITICAL CONTEXT AWARENESS:
- These are personal memories belonging to ONE USER
- Different names (Davut, Ahmet, first person pronouns) may refer to the SAME PERSON
- Pay attention to personal pronouns ("I am", "Ben", "my") - these refer to the memory owner
- Look for corrections/updates to existing personal information

DECISION RULES:
1. **UPDATE**: If new memory corrects/refines existing information about the SAME PERSON
   - Religious status changes: "I was Muslim" → "I'm not Muslim"
   - Personal detail corrections: "I'm 24" → "I'm 27" 
   - Preference updates: "I like X" → "I prefer Y"
   
2. **CREATE**: If new memory contains information about DIFFERENT people or entirely new topics

3. **SKIP**: If new memory is essentially identical (rare)

IDENTITY MATCHING:
- Names like "Davut", "Ahmet" likely refer to the same user (owner of these memories)
- First person statements ("I am", "Ben") definitely refer to the memory owner
- Look for personal corrections that override previous statements

Be conservative - when in doubt about identity, prefer UPDATE over CREATE for personal information.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: zodResponseFormat(MemoryDecisionSchema, 'memory_decision'),
        temperature: 0.1,
      });

      const decision = response.choices[0]?.message.parsed;
      if (!decision) {
        throw new Error('No decision received from AI');
      }

      return decision;

    } catch (error) {
      console.error('Error in AI memory analysis:', error);
      // Default to CREATE for safety
      return {
        action: 'create',
        targetMemoryId: null,
        confidence: 0.5,
        reasoning: `AI analysis failed, defaulting to create: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Build analysis prompt for AI
   */
  private buildAnalysisPrompt(
    newMemory: CreateMemoryInput, 
    existingMemories: Memory[],
    userContext?: {
      userId: string;
      userName?: string;
    }
  ): string {
    const existingMemoriesText = existingMemories
      .map((memory, index) => 
        `${index + 1}. ID: ${memory.id}
Content: ${memory.content}
Summary: ${memory.summary || 'No summary'}
Tags: ${memory.tags?.join(', ') || 'No tags'}
Created: ${memory.createdAt}
---`)
      .join('\n');

    const userContextText = userContext ? `
USER CONTEXT:
- User ID: ${userContext.userId}
- Known name: ${userContext.userName ? userContext.userName : 'Unknown'}
- Note: All memories below belong to this same user

` : '';

    return `${userContextText}NEW MEMORY TO ANALYZE:
Content: ${newMemory.content}
Summary: ${newMemory.summary || 'No summary'}
Tags: ${newMemory.tags?.join(', ') || 'No tags'}

EXISTING SIMILAR MEMORIES:
${existingMemoriesText}

Question: Should this new memory UPDATE an existing one, CREATE a new entry, or be SKIPPED?

IMPORTANT: Remember that different names in the memories may refer to the same person (the memory owner). Look for personal corrections, updates, or contradictions.

Provide your analysis considering:
1. Identity matching - do any memories refer to the same person?
2. Content similarity and overlap
3. Whether this is new information vs correction to existing
4. Personal vs third-party information
5. User's likely intent (correction vs new fact)`;
  }

  /**
   * Execute the decided memory action
   */
  private async executeMemoryAction(
    input: CreateMemoryInput,
    context: DatabaseContext,
    decision: MemoryDecision,
    existingMemories: Memory[]
  ): Promise<{
    action: 'created' | 'updated' | 'skipped';
    memoryId: string;
    reason: string;
    similarMemories?: Memory[];
  }> {
    switch (decision.action) {
      case 'update':
        if (!decision.targetMemoryId) {
          throw new Error('Update action requires targetMemoryId');
        }
        
        const updateData: {
          content?: string;
          summary?: string;
          tags?: string[];
          metadata?: Record<string, any>;
        } = {
          content: input.content,
          metadata: {
            ...input.metadata,
            lastUpdated: new Date().toISOString(),
            updateReason: 'Smart deduplication merge',
            originalMemoryBackup: existingMemories.find(m => m.id === decision.targetMemoryId)?.content
          }
        };

        if (input.summary) {
          updateData.summary = input.summary;
        }

        if (input.tags) {
          updateData.tags = input.tags;
        }

        await this.memoryService.updateMemory(decision.targetMemoryId, updateData);

        return {
          action: 'updated',
          memoryId: decision.targetMemoryId,
          reason: decision.reasoning,
          similarMemories: existingMemories,
        };

      case 'skip':
        // Return the most similar existing memory
        const mostSimilar = existingMemories[0];
        if (!mostSimilar) {
          throw new Error('No existing memories found for skip action');
        }
        return {
          action: 'skipped',
          memoryId: mostSimilar.id,
          reason: decision.reasoning,
          similarMemories: existingMemories,
        };

      case 'create':
      default:
        const memoryId = await this.memoryService.createMemory(input, context);
        return {
          action: 'created',
          memoryId,
          reason: decision.reasoning,
          similarMemories: existingMemories,
        };
    }
  }

  /**
   * Batch smart memory creation for multiple memories
   */
  async smartCreateMultipleMemories(
    memories: CreateMemoryInput[],
    context: DatabaseContext
  ): Promise<Array<{
    index: number;
    input: CreateMemoryInput;
    result: {
      action: 'created' | 'updated' | 'skipped';
      memoryId: string;
      reason: string;
      similarMemories?: Memory[];
    };
  }>> {
    const results = [];

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      if (!memory) continue; // Skip undefined entries
      
      try {
        const result = await this.smartCreateMemory(memory, context);
        results.push({
          index: i,
          input: memory,
          result
        });
      } catch (error) {
        console.error(`Error processing memory ${i}:`, error);
        // Create fallback entry
        const memoryId = await this.memoryService.createMemory(memory, context);
        results.push({
          index: i,
          input: memory,
          result: {
            action: 'created' as const,
            memoryId,
            reason: `Fallback creation: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        });
      }
    }

    return results;
  }
}

// Schema for AI decision response
const MemoryDecisionSchema = z.object({
  action: z.enum(['create', 'update', 'skip']).describe('The action to take with the new memory'),
  targetMemoryId: z.string().nullish().describe('ID of existing memory to update (only for update action)'),
  confidence: z.number().min(0).max(1).describe('Confidence level in the decision (0-1)'),
  reasoning: z.string().describe('Explanation of why this action was chosen'),
});

type MemoryDecision = z.infer<typeof MemoryDecisionSchema>;

// Singleton instance
export const memoryDeduplicationService = new MemoryDeduplicationService(); 