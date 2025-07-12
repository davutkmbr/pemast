export const buildSystemPrompt = (prompt: string, personalContext?: string) => {
  const basePrompt = `Today is ${new Date().toISOString().split("T")[0]}.`;

  let enhancedPrompt = prompt;

  // Inject personal context into the instructions if available
  if (
    personalContext &&
    personalContext.trim() !== "No personal information available about this user yet."
  ) {
    enhancedPrompt =
      prompt +
      `

## PERSONAL CONTEXT FOR THIS USER

${personalContext}

Remember to use this personal information naturally in your responses to be more helpful and personalized.`;
  }

  return `${basePrompt} ${enhancedPrompt}`;
};
