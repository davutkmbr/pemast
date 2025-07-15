import { RECOMMENDED_PROMPT_PREFIX } from "@openai/agents-core/extensions";
import { formatDate } from "../agent/utils/date.utils.js";

export const buildSystemPrompt = (prompt: string, appends?: string[]) => {
  const now = new Date();
  const formattedDateTime = formatDate(now);
  const basePrompt = `Today is ${formattedDateTime}. ${RECOMMENDED_PROMPT_PREFIX}`;

  // If there's additional context to append, add it with spacing
  const enhancedPrompt = appends ? `${prompt}\n\n${appends.join("\n\n")}` : prompt;

  return `${basePrompt} ${enhancedPrompt}`;
};
