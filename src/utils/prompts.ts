export const buildSystemPrompt = (prompt: string, appends?: string[]) => {
  const today = new Date().toISOString().split("T")[0];
  const basePrompt = `Today is ${today}.`;

  // If there's additional context to append, add it with spacing
  const enhancedPrompt = appends ? `${prompt}\n\n${appends.join("\n\n")}` : prompt;

  return `${basePrompt} ${enhancedPrompt}`;
};
