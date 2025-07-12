import { USER_PREFERENCE_VALUES } from "../services/user-preferences.service.js";
import { stringBuilder } from "./string-builder.js";

/**
 * Build preference validation error message
 */
export function buildValidationError(key: string, value: string, allowedValues: string[]): string {
  return stringBuilder(
    `❌ Invalid value '${value}' for preference '${key}'.\n`,
    `Allowed values: ${allowedValues.join(", ")}`,
  );
}

/**
 * Build success message for setting a preference
 */
export function buildPreferenceSuccess(key: string, value: string, id: string): string {
  return `✅ Set '${key}' = '${value}' (id: ${id})`;
}

/**
 * Build error message for failed preference setting
 */
export function buildPreferenceError(index: number, key: string, error: string): string {
  return `Preference ${index}: ❌ Failed to set '${key}' - ${error}`;
}

/**
 * Build complete response summary
 */
export function buildResponseSummary(
  totalCount: number,
  successCount: number,
  errorCount: number,
  results: string[],
  errors: string[],
): string {
  return stringBuilder(
    `⚙️ User Preferences Update: ${totalCount} preferences → ${successCount} updated, ${errorCount} errors\n\n`,
    results.length > 0 && `${results.join("\n")}\n`,
    errors.length > 0 && `\n❌ Errors:\n${errors.join("\n")}`,
    successCount > 0 &&
      `\n💡 Your preferences have been saved and will be applied to future conversations.`,
  );
}

/**
 * Build tool description with available values
 */
export function buildToolDescription(): string {
  return stringBuilder(
    `Set or update user preferences to customize the assistant's behavior.\n\n`,
    `Available preference keys and their valid values:\n\n`,
    `**Language & Communication:**\n`,
    `- language: ${Object.values(USER_PREFERENCE_VALUES.LANGUAGES).join(", ")}\n`,
    `- communication_style: ${Object.values(USER_PREFERENCE_VALUES.COMMUNICATION_STYLES).join(", ")}\n`,
    `- response_tone: ${Object.values(USER_PREFERENCE_VALUES.RESPONSE_TONES).join(", ")}\n`,
    `- response_length: ${Object.values(USER_PREFERENCE_VALUES.RESPONSE_LENGTHS).join(", ")}\n`,
    `- text_case: ${Object.values(USER_PREFERENCE_VALUES.TEXT_CASE).join(", ")}\n\n`,
    `**Assistant Behavior:**\n`,
    `- assistant_personality: ${Object.values(USER_PREFERENCE_VALUES.ASSISTANT_PERSONALITIES).join(", ")}\n`,
    `- emoji_usage: ${Object.values(USER_PREFERENCE_VALUES.EMOJI_USAGE).join(", ")}\n\n`,
    `**Other Preferences:**\n`,
    `- greeting_style: (any custom greeting style)\n`,
    `- reminder_format: (custom reminder format)\n`,
    `- reminder_time_preference: (preferred reminder times)\n\n`,
    `Use this tool when users want to customize how the assistant behaves, communicates, or responds.`,
  );
}
