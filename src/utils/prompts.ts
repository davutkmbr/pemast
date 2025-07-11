export const buildSystemPrompt = (prompt: string) => {
    const basePrompt = `Today is ${new Date().toISOString().split('T')[0]}.`;

    return `${basePrompt} ${prompt}`;
};