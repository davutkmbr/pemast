import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import type {
  CreateUserPreferenceInput,
  DatabaseContext,
  UpdateUserPreferenceInput,
  UserPreference,
} from "../types/index.js";

/**
 * User preference key schema and type
 */
export const UserPreferenceKeySchema = z.enum([
  "language",
  "communication_style",
  "response_tone",
  "response_length",
  "assistant_personality",
  "greeting_style",
  "emoji_usage",
  "reminder_format",
  "reminder_time_preference",
]);
export type UserPreferenceKey = z.infer<typeof UserPreferenceKeySchema>;

/**
 * User preference keys as constants for compatibility
 */
export const USER_PREFERENCE_KEYS = {
  LANGUAGE: "language",
  COMMUNICATION_STYLE: "communication_style",
  RESPONSE_TONE: "response_tone",
  RESPONSE_LENGTH: "response_length",
  ASSISTANT_PERSONALITY: "assistant_personality",
  GREETING_STYLE: "greeting_style",
  EMOJI_USAGE: "emoji_usage",
  REMINDER_FORMAT: "reminder_format",
  REMINDER_TIME_PREFERENCE: "reminder_time_preference",
} as const;

/**
 * Possible values for user preferences as zod enums
 */
export const LanguageSchema = z.enum(["tr", "en", "de", "fr", "es"]);
export const CommunicationStyleSchema = z.enum([
  "formal",
  "casual",
  "friendly",
  "professional",
  "humorous",
]);
export const ResponseToneSchema = z.enum(["neutral", "warm", "enthusiastic", "calm", "direct"]);
export const ResponseLengthSchema = z.enum(["brief", "medium", "detailed", "comprehensive"]);
export const AssistantPersonalitySchema = z.enum([
  "helpful",
  "wise",
  "creative",
  "analytical",
  "empathetic",
]);
export const GreetingStyleSchema = z.enum(["formal", "casual", "warm", "professional", "cheerful"]);
export const EmojiUsageSchema = z.enum(["none", "minimal", "moderate", "frequent"]);
export const ReminderFormatSchema = z.enum(["simple", "detailed", "structured", "casual"]);
export const ReminderTimePreferenceSchema = z.enum(["morning", "afternoon", "evening", "flexible"]);

/**
 * Grouped user preference value schemas for easy access
 */
export const USER_PREFERENCE_SCHEMAS = {
  language: LanguageSchema,
  communication_style: CommunicationStyleSchema,
  response_tone: ResponseToneSchema,
  response_length: ResponseLengthSchema,
  assistant_personality: AssistantPersonalitySchema,
  greeting_style: GreetingStyleSchema,
  emoji_usage: EmojiUsageSchema,
  reminder_format: ReminderFormatSchema,
  reminder_time_preference: ReminderTimePreferenceSchema,
} as const;

/**
 * Type mapping for user preference keys to their allowed values
 */
export type UserPreferenceValueMap = {
  language: z.infer<typeof LanguageSchema>;
  communication_style: z.infer<typeof CommunicationStyleSchema>;
  response_tone: z.infer<typeof ResponseToneSchema>;
  response_length: z.infer<typeof ResponseLengthSchema>;
  assistant_personality: z.infer<typeof AssistantPersonalitySchema>;
  greeting_style: z.infer<typeof GreetingStyleSchema>;
  emoji_usage: z.infer<typeof EmojiUsageSchema>;
  reminder_format: z.infer<typeof ReminderFormatSchema>;
  reminder_time_preference: z.infer<typeof ReminderTimePreferenceSchema>;
};

/**
 * Typed preference entry - discriminated union ensuring each key only allows its specific values
 */
export type TypedUserPreference =
  | { key: "language"; value: z.infer<typeof LanguageSchema> }
  | { key: "communication_style"; value: z.infer<typeof CommunicationStyleSchema> }
  | { key: "response_tone"; value: z.infer<typeof ResponseToneSchema> }
  | { key: "response_length"; value: z.infer<typeof ResponseLengthSchema> }
  | { key: "assistant_personality"; value: z.infer<typeof AssistantPersonalitySchema> }
  | { key: "greeting_style"; value: z.infer<typeof GreetingStyleSchema> }
  | { key: "emoji_usage"; value: z.infer<typeof EmojiUsageSchema> }
  | { key: "reminder_format"; value: z.infer<typeof ReminderFormatSchema> }
  | { key: "reminder_time_preference"; value: z.infer<typeof ReminderTimePreferenceSchema> };

/**
 * For compatibility: object of possible values (for legacy code)
 */
export const USER_PREFERENCE_VALUES = {
  LANGUAGES: {
    TURKISH: "tr",
    ENGLISH: "en",
    GERMAN: "de",
    FRENCH: "fr",
    SPANISH: "es",
  },
  COMMUNICATION_STYLES: {
    FORMAL: "formal",
    CASUAL: "casual",
    FRIENDLY: "friendly",
    PROFESSIONAL: "professional",
    HUMOROUS: "humorous",
  },
  RESPONSE_TONES: {
    NEUTRAL: "neutral",
    WARM: "warm",
    ENTHUSIASTIC: "enthusiastic",
    CALM: "calm",
    DIRECT: "direct",
  },
  RESPONSE_LENGTHS: {
    BRIEF: "brief",
    MEDIUM: "medium",
    DETAILED: "detailed",
    COMPREHENSIVE: "comprehensive",
  },
  ASSISTANT_PERSONALITIES: {
    HELPFUL: "helpful",
    WISE: "wise",
    CREATIVE: "creative",
    ANALYTICAL: "analytical",
    EMPATHETIC: "empathetic",
  },
  GREETING_STYLES: {
    FORMAL: "formal",
    CASUAL: "casual",
    WARM: "warm",
    PROFESSIONAL: "professional",
    CHEERFUL: "cheerful",
  },
  EMOJI_USAGE: {
    NONE: "none",
    MINIMAL: "minimal",
    MODERATE: "moderate",
    FREQUENT: "frequent",
  },
  REMINDER_FORMATS: {
    SIMPLE: "simple",
    DETAILED: "detailed",
    STRUCTURED: "structured",
    CASUAL: "casual",
  },
  REMINDER_TIME_PREFERENCES: {
    MORNING: "morning",
    AFTERNOON: "afternoon",
    EVENING: "evening",
    FLEXIBLE: "flexible",
  },
} as const;

export class UserPreferencesService {
  /**
   * Get a specific user preference by key
   */
  async getPreference(
    context: DatabaseContext,
    key: UserPreferenceKey,
  ): Promise<UserPreference | undefined> {
    const [preference] = await db
      .select()
      .from(schema.userPreferences)
      .where(
        and(
          eq(schema.userPreferences.projectId, context.projectId),
          eq(schema.userPreferences.userId, context.userId),
          eq(schema.userPreferences.key, key),
        ),
      )
      .limit(1);

    return preference;
  }

  /**
   * Get all user preferences
   */
  async getAllPreferences(context: DatabaseContext): Promise<UserPreference[]> {
    return await db
      .select()
      .from(schema.userPreferences)
      .where(
        and(
          eq(schema.userPreferences.projectId, context.projectId),
          eq(schema.userPreferences.userId, context.userId),
        ),
      )
      .orderBy(schema.userPreferences.key);
  }

  /**
   * Get preferences as a key-value map for easy access
   */
  async getPreferencesMap(context: DatabaseContext): Promise<UserPreferenceValueMap> {
    const userPreferences = await this.getAllPreferences(context);
    const defaultPreferences = this.getDefaultPreferences();

    // Start with defaults, then override with user preferences
    const map: UserPreferenceValueMap = {} as UserPreferenceValueMap;

    // First, add all defaults
    for (const pref of defaultPreferences) {
      // @ts-ignore
      map[pref.key] = pref.value;
    }

    // Then override with user preferences
    for (const pref of userPreferences) {
      // @ts-ignore
      map[pref.key] = pref.value;
    }

    return map;
  }

  /**
   * Get preferences for prompt
   */
  async getPreferencesForPrompt(context: DatabaseContext): Promise<string> {
    const preferencesMap = await this.getPreferencesMap(context);

    let prompt = `=== USER PREFERENCES ===\n\n`;

    for (const [key, value] of Object.entries(preferencesMap)) {
      prompt += `${key}: ${value}\n`;
    }

    prompt += `\n=== END OF USER PREFERENCES ===\n\n`;

    return prompt;
  }

  /**
   * Set or update a user preference
   */
  async setPreference<K extends UserPreferenceKey>(
    context: DatabaseContext,
    key: K,
    input: CreateUserPreferenceInput & { value: UserPreferenceValueMap[K] },
  ): Promise<UserPreference> {
    // Validate the value against the schema
    const prefSchema = USER_PREFERENCE_SCHEMAS[key];
    const validatedValue = prefSchema.parse(input.value);

    // Check if preference already exists
    const existing = await this.getPreference(context, key);

    if (existing) {
      // Update existing preference
      const [updated] = await db
        .update(schema.userPreferences)
        .set({
          value: validatedValue,
          metadata: input.metadata,
          updatedAt: new Date(),
        })
        .where(eq(schema.userPreferences.id, existing.id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update preference");
      }

      return updated;
    } else {
      // Create new preference
      const [created] = await db
        .insert(schema.userPreferences)
        .values({
          projectId: context.projectId,
          userId: context.userId,
          key,
          value: validatedValue,
          metadata: input.metadata,
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create preference");
      }

      return created;
    }
  }

  /**
   * Update an existing preference
   */
  async updatePreference<K extends UserPreferenceKey>(
    context: DatabaseContext,
    key: K,
    input: UpdateUserPreferenceInput & { value: UserPreferenceValueMap[K] },
  ): Promise<UserPreference | undefined> {
    const existing = await this.getPreference(context, key);
    if (!existing) {
      return undefined;
    }

    // Validate the value against the schema
    const prefSchema = USER_PREFERENCE_SCHEMAS[key];
    const validatedValue = prefSchema.parse(input.value);

    const [updated] = await db
      .update(schema.userPreferences)
      .set({
        value: validatedValue,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(schema.userPreferences.id, existing.id))
      .returning();

    return updated;
  }

  /**
   * Delete a user preference
   */
  async deletePreference(context: DatabaseContext, key: UserPreferenceKey): Promise<boolean> {
    const result = await db
      .delete(schema.userPreferences)
      .where(
        and(
          eq(schema.userPreferences.projectId, context.projectId),
          eq(schema.userPreferences.userId, context.userId),
          eq(schema.userPreferences.key, key),
        ),
      );

    return result.count > 0;
  }

  /**
   * Set multiple preferences at once
   */
  async setMultiplePreferences(
    context: DatabaseContext,
    preferences: Array<TypedUserPreference & { metadata?: Record<string, any> }>,
  ): Promise<UserPreference[]> {
    const results: UserPreference[] = [];

    for (const pref of preferences) {
      const input = {
        key: pref.key,
        value: pref.value,
        ...(pref.metadata && { metadata: pref.metadata }),
      };
      const result = await this.setPreference(context, pref.key, input as any);
      results.push(result);
    }

    return results;
  }

  /**
   * Reset all user preferences (delete all)
   */
  async resetAllPreferences(context: DatabaseContext): Promise<void> {
    await db
      .delete(schema.userPreferences)
      .where(
        and(
          eq(schema.userPreferences.projectId, context.projectId),
          eq(schema.userPreferences.userId, context.userId),
        ),
      );
  }

  /**
   * Get default preferences for a new user
   */
  getDefaultPreferences(): Array<TypedUserPreference> {
    return [
      { key: "language", value: "en" },
      { key: "communication_style", value: "friendly" },
      { key: "response_tone", value: "warm" },
      { key: "response_length", value: "medium" },
      { key: "assistant_personality", value: "helpful" },
      { key: "greeting_style", value: "warm" },
      { key: "emoji_usage", value: "moderate" },
      { key: "reminder_format", value: "simple" },
      { key: "reminder_time_preference", value: "flexible" },
    ] as const;
  }
}
