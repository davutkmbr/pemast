import { type RunContext, tool } from "@openai/agents";
import { z } from "zod";
import {
  USER_PREFERENCE_KEYS,
  USER_PREFERENCE_VALUES,
  type UserPreferenceKey,
  UserPreferencesService,
} from "../../services/user-preferences.service.js";
import type { DatabaseContext, GatewayContext } from "../../types/index.js";
import {
  buildPreferenceError,
  buildPreferenceSuccess,
  buildResponseSummary,
  buildToolDescription,
  buildValidationError,
} from "../../utils/preference-response-builder.js";

/**
 * Tool: set_user_preference
 * Allows users to customize their assistant preferences including language,
 * communication style, response tone, and other behavioral settings.
 *
 * This tool validates preference keys and values to ensure only valid combinations are set.
 */

// Preference validation schemas
const PreferenceParams = z.object({
  key: z
    .enum([
      USER_PREFERENCE_KEYS.LANGUAGE,
      USER_PREFERENCE_KEYS.COMMUNICATION_STYLE,
      USER_PREFERENCE_KEYS.RESPONSE_TONE,
      USER_PREFERENCE_KEYS.RESPONSE_LENGTH,
      USER_PREFERENCE_KEYS.ASSISTANT_PERSONALITY,
      USER_PREFERENCE_KEYS.GREETING_STYLE,
      USER_PREFERENCE_KEYS.EMOJI_USAGE,
      USER_PREFERENCE_KEYS.REMINDER_FORMAT,
      USER_PREFERENCE_KEYS.REMINDER_TIME_PREFERENCE,
      USER_PREFERENCE_KEYS.TEXT_CASE,
    ] as const)
    .describe("The preference key to set"),

  value: z.string().describe("The preference value to set"),

  metadata: z.object({}).nullish().describe("Optional metadata for complex preferences"),
});

const SetUserPreferenceParams = z.object({
  preferences: z
    .array(PreferenceParams)
    .min(1)
    .describe("Array of user preferences to set or update"),
});

type PreferenceInput = z.infer<typeof PreferenceParams>;

/**
 * Get validation rules for preference values
 */
function getValidationRules(): Record<string, string[]> {
  return {
    [USER_PREFERENCE_KEYS.LANGUAGE]: Object.values(USER_PREFERENCE_VALUES.LANGUAGES),
    [USER_PREFERENCE_KEYS.COMMUNICATION_STYLE]: Object.values(
      USER_PREFERENCE_VALUES.COMMUNICATION_STYLES,
    ),
    [USER_PREFERENCE_KEYS.RESPONSE_TONE]: Object.values(USER_PREFERENCE_VALUES.RESPONSE_TONES),
    [USER_PREFERENCE_KEYS.RESPONSE_LENGTH]: Object.values(USER_PREFERENCE_VALUES.RESPONSE_LENGTHS),
    [USER_PREFERENCE_KEYS.ASSISTANT_PERSONALITY]: Object.values(
      USER_PREFERENCE_VALUES.ASSISTANT_PERSONALITIES,
    ),
    [USER_PREFERENCE_KEYS.EMOJI_USAGE]: Object.values(USER_PREFERENCE_VALUES.EMOJI_USAGE),
    [USER_PREFERENCE_KEYS.TEXT_CASE]: Object.values(USER_PREFERENCE_VALUES.TEXT_CASE),
  };
}

/**
 * Validates preference value against allowed values for specific keys
 */
function validatePreferenceValue(
  key: UserPreferenceKey,
  value: string,
): { valid: boolean; error?: string } {
  const validationRules = getValidationRules();
  const allowedValues = validationRules[key];

  // If no specific validation rules, accept any string
  if (!allowedValues) {
    return { valid: true };
  }

  if (!allowedValues.includes(value)) {
    return {
      valid: false,
      error: buildValidationError(key, value, allowedValues),
    };
  }

  return { valid: true };
}

/**
 * Process a single preference setting
 */
async function processSinglePreference(
  preference: PreferenceInput,
  dbContext: DatabaseContext,
  userPreferencesService: UserPreferencesService,
): Promise<{ success: boolean; message: string }> {
  try {
    // Validate preference value
    const validation = validatePreferenceValue(preference.key, preference.value);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || "Validation failed",
      };
    }

    // Set the preference - value is validated so we can safely cast it
    const result = await userPreferencesService.setPreference(dbContext, preference.key, {
      key: preference.key,
      value: preference.value as any, // Safe cast after validation
      ...(preference.metadata && { metadata: preference.metadata }),
    });

    return {
      success: true,
      message: buildPreferenceSuccess(preference.key, preference.value, result.id),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process multiple preference updates
 */
async function processPreferences(
  preferences: PreferenceInput[],
  dbContext: DatabaseContext,
): Promise<{ results: string[]; errors: string[] }> {
  const results: string[] = [];
  const errors: string[] = [];
  const userPreferencesService = new UserPreferencesService();

  for (let i = 0; i < preferences.length; i++) {
    const pref = preferences[i];
    if (!pref) continue;

    const result = await processSinglePreference(pref, dbContext, userPreferencesService);

    if (result.success) {
      results.push(result.message);
    } else {
      errors.push(buildPreferenceError(i + 1, pref.key, result.message));
    }
  }

  console.log("🎛️ Preferences processed:", results, "🚨 Errors:", errors);

  return { results, errors };
}

export const setUserPreferenceTool = tool({
  name: "set_user_preference",
  description: buildToolDescription(),
  parameters: SetUserPreferenceParams,
  strict: true,
  execute: async (
    data: z.infer<typeof SetUserPreferenceParams>,
    runContext?: RunContext<GatewayContext>,
  ) => {
    const context = runContext?.context;
    if (!context) {
      return "⚠️ Missing database context; cannot set preferences.";
    }

    const { results, errors } = await processPreferences(data.preferences, context);

    const totalCount = data.preferences.length;
    const successCount = results.length;
    const errorCount = errors.length;

    return buildResponseSummary(totalCount, successCount, errorCount, results, errors);
  },
});
