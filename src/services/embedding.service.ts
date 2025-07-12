import OpenAI from "openai";

/**
 * Generic embedding service for generating text embeddings
 * Can be used by MemoryService, ReminderService, FactsService, etc.
 */
export class EmbeddingService {
  private config: {
    model: string;
    dimensions: number;
    maxRetries: number;
    retryDelay: number;
    maxTokens: number;
  };
  private openai: OpenAI | null = null;

  constructor(config?: Partial<EmbeddingService["config"]>) {
    this.config = {
      model: "text-embedding-3-small",
      dimensions: 1536,
      maxRetries: 3,
      retryDelay: 1000,
      maxTokens: 8192, // OpenAI's token limit for embeddings
      ...config,
    };

    this.initializeOpenAI();
  }

  /**
   * Initialize OpenAI client if API key is available
   */
  private initializeOpenAI(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
      console.log("✅ OpenAI client initialized for embeddings");
    } else {
      console.warn("⚠️ OPENAI_API_KEY not found - embeddings will be disabled");
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      console.warn("Empty text provided for embedding generation");
      return [];
    }

    if (!this.openai) {
      console.warn("OpenAI not initialized - returning empty embedding");
      return [];
    }

    try {
      // Prepare text for embedding generation
      const preparedText = this.prepareTextForEmbedding(text, {
        maxLength: this.config.maxTokens * 4, // Rough char-to-token conversion
        removeExtraSpaces: true,
        toLowerCase: false, // Keep original case for better semantic understanding
      });

      if (!preparedText) {
        console.warn("Text preparation resulted in empty string");
        return [];
      }

      console.log(`Generating embedding for text: "${preparedText.substring(0, 50)}..."`);

      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: preparedText,
        dimensions: this.config.dimensions,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding || embedding.length === 0) {
        console.error("OpenAI returned empty embedding");
        return [];
      }

      console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);

      // Check for specific OpenAI errors
      if (error instanceof Error) {
        if (error.message.includes("rate limit")) {
          console.warn("Rate limit hit - consider using retry logic");
        } else if (error.message.includes("token")) {
          console.warn("Token limit exceeded - text may be too long");
        }
      }

      return [];
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    if (!this.openai) {
      console.warn("OpenAI not initialized - returning empty embeddings");
      return texts.map(() => []);
    }

    try {
      // Filter and prepare texts
      const preparedTexts = texts
        .filter((text) => text && text.trim().length > 0)
        .map((text) =>
          this.prepareTextForEmbedding(text, {
            maxLength: this.config.maxTokens * 4,
            removeExtraSpaces: true,
            toLowerCase: false,
          }),
        )
        .filter((text) => text.length > 0);

      if (preparedTexts.length === 0) {
        return [];
      }

      console.log(`Generating embeddings for ${preparedTexts.length} texts`);

      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: preparedTexts,
        dimensions: this.config.dimensions,
      });

      const embeddings = response.data.map((item) => item.embedding);
      console.log(`✅ Generated ${embeddings.length} embeddings`);

      return embeddings;
    } catch (error) {
      console.error("Error generating batch embeddings:", error);
      return texts.map(() => []);
    }
  }

  /**
   * Generate embedding with retry logic
   */
  async generateEmbeddingWithRetry(text: string): Promise<number[]> {
    if (!this.openai) {
      console.warn("OpenAI not initialized - skipping retry logic");
      return [];
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.generateEmbedding(text);
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Embedding generation attempt ${attempt}/${this.config.maxRetries} failed:`,
          error,
        );

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * attempt;
          console.log(`Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    console.error("All embedding generation attempts failed:", lastError);
    return [];
  }

  /**
   * Prepare text for embedding generation
   * Handles common preprocessing tasks
   */
  prepareTextForEmbedding(
    text: string,
    options?: {
      maxLength?: number;
      removeExtraSpaces?: boolean;
      toLowerCase?: boolean;
    },
  ): string {
    if (!text) return "";

    let processed = text;

    // Remove extra whitespace
    if (options?.removeExtraSpaces !== false) {
      processed = processed.replace(/\s+/g, " ").trim();
    }

    // Convert to lowercase
    if (options?.toLowerCase) {
      processed = processed.toLowerCase();
    }

    // Truncate if too long
    if (options?.maxLength && processed.length > options.maxLength) {
      processed = processed.substring(0, options.maxLength);
      console.warn(`Text truncated to ${options.maxLength} characters for embedding`);
    }

    return processed;
  }

  /**
   * Combine multiple text fields for embedding
   * Useful for search text generation
   */
  combineFieldsForEmbedding(
    fields: (string | undefined | null)[],
    separator: string = " ",
  ): string {
    const combined = fields
      .filter((field) => field && field.trim().length > 0)
      .map((field) => field!.trim())
      .join(separator);

    // Prepare the combined text
    return this.prepareTextForEmbedding(combined, {
      maxLength: this.config.maxTokens * 4,
      removeExtraSpaces: true,
      toLowerCase: false,
    });
  }

  /**
   * Check if embeddings are enabled/configured
   */
  isEmbeddingEnabled(): boolean {
    return this.openai !== null && !!process.env.OPENAI_API_KEY;
  }

  /**
   * Get embedding configuration info
   */
  getConfig() {
    return {
      ...this.config,
      isEnabled: this.isEmbeddingEnabled(),
      hasApiKey: !!process.env.OPENAI_API_KEY,
    };
  }

  /**
   * Update configuration and reinitialize if needed
   */
  updateConfig(newConfig: Partial<EmbeddingService["config"]>): void {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize OpenAI if needed
    if (!this.openai) {
      this.initializeOpenAI();
    }
  }

  /**
   * Test the embedding service with a simple text
   */
  async testEmbedding(): Promise<{ success: boolean; dimensions?: number; error?: string }> {
    try {
      const testText = "This is a test for embedding generation";
      const embedding = await this.generateEmbedding(testText);

      if (embedding.length > 0) {
        return {
          success: true,
          dimensions: embedding.length,
        };
      } else {
        return {
          success: false,
          error: "Generated embedding is empty",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Utility delay function for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Create a singleton instance for app-wide use
export const embeddingService = new EmbeddingService();

// Export types for other services
export interface EmbeddingConfig {
  model?: string;
  dimensions?: number;
  maxRetries?: number;
  retryDelay?: number;
  maxTokens?: number;
}
