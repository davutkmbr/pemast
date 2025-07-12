import { RECOMMENDED_PROMPT_PREFIX } from "@openai/agents-core/extensions";

export const buildSystemPrompt = (prompt: string, appends?: string[]) => {
  const today = new Date().toISOString().split("T")[0];
  const basePrompt = `Today is ${today}. ${RECOMMENDED_PROMPT_PREFIX}`;

  // If there's additional context to append, add it with spacing
  const enhancedPrompt = appends ? `${prompt}\n\n${appends.join("\n\n")}` : prompt;

  return `${basePrompt} ${enhancedPrompt}`;
};
