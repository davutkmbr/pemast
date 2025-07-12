import { type RunContext, tool } from "@openai/agents";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { FileType } from "../../gateways/base-gateway.js";
import { FileService } from "../../services/file.service.js";
import { MemoryService } from "../../services/memory.service.js";
import type { DatabaseContext, GatewayContext, Memory } from "../../types/index.js";

/**
 * Tool: file_retriever
 * Retrieves memories with attached files relevant to a user query.
 * Only returns memories that have associated files.
 */
const FileRetrieverParams = z.object({
  query: z.string().describe("User search query for files. Can be a question or keywords."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Maximum number of results to return (1-20). Optional."),
});

export type FileRetrieverParams = z.infer<typeof FileRetrieverParams>;

/**
 * Schema for AI relevance scoring
 */
const RelevanceScore = z.object({
  memoryIndex: z.number().describe("Index of the memory in the original list"),
  relevanceScore: z.number().min(0).max(10).describe("Relevance score from 0-10"),
  reasoning: z.string().describe("Brief explanation of why this file is relevant"),
  shouldSendFile: z.boolean().describe("Whether to send the associated file"),
});

const FilterResults = z.object({
  scores: z.array(RelevanceScore),
  summary: z.string().describe("Overall summary of filtering decisions"),
});

/**
 * Helper function to determine FileType from mimeType
 */
function getFileTypeFromMimeType(mimeType: string): FileType {
  if (mimeType.startsWith("image/")) {
    return "photo";
  }
  if (mimeType.startsWith("audio/")) {
    // Check if it's a voice message (usually ogg or specific audio formats for voice)
    if (mimeType.includes("ogg") || mimeType.includes("opus")) {
      return "voice";
    }
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  // Default to document for everything else
  return "document";
}

/**
 * Interface for tracking sent files
 */
interface SentFileInfo {
  fileName: string;
  fileType: FileType;
  mimeType: string;
  size?: number;
}

/**
 * AI-powered relevance filtering for file search results
 */
async function filterMemoriesWithAI(
  query: string,
  memories: Memory[],
): Promise<{ filteredMemories: Memory[]; reasoning: string }> {
  if (memories.length === 0) {
    return { filteredMemories: [], reasoning: "No file memories to filter" };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Prepare memory summaries for AI evaluation with file context
    const memoryDescriptions = memories
      .map((memory, index) => {
        return `${index}: "${memory.content}" ${memory.summary ? `(Summary: ${memory.summary})` : ""} [HAS FILE]`;
      })
      .join("\n");

    const prompt = `Analyze the following file search results and determine which file memories are truly relevant to the user's query.

USER QUERY: "${query}"

FILE MEMORIES (all have attached files):
${memoryDescriptions}

For each file memory, provide:
1. A relevance score (0-10) where 10 = highly relevant file, 0 = completely irrelevant file
2. Brief reasoning about file relevance
3. Whether the associated file should be sent to the user

Focus on finding files that match the user's intent. If they ask for "presentation slides" prioritize document files, if they ask for "photos" prioritize image files.`;

    const model = process.env.UTILITY_MODEL;
    if (!model) {
      throw new Error("FileRetriever: model is not set");
    }

    const response = await openai.chat.completions.parse({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: zodResponseFormat(FilterResults, "filter_results"),
      temperature: 0.1,
    });

    const filterResults = response.choices[0]?.message?.parsed;
    if (!filterResults) {
      console.warn("AI filtering failed, using all file memories");
      return { filteredMemories: memories, reasoning: "AI filtering unavailable" };
    }

    // Filter memories based on AI scores (threshold: 6/10)
    const relevantScores = filterResults.scores.filter(
      (score: z.infer<typeof RelevanceScore>) => score.relevanceScore >= 6 && score.shouldSendFile,
    );

    const filteredMemories = relevantScores
      .map((score: z.infer<typeof RelevanceScore>) => memories[score.memoryIndex])
      .filter((memory): memory is Memory => memory !== undefined);

    console.log(`🤖 File Filter: ${memories.length} → ${filteredMemories.length} file memories`);
    console.log(`Reasoning: ${filterResults.summary}`);

    return {
      filteredMemories,
      reasoning: filterResults.summary,
    };
  } catch (error) {
    console.error("AI filtering error:", error);
    // Fallback to original memories if AI fails
    return {
      filteredMemories: memories,
      reasoning: "AI filtering failed, showing all file results",
    };
  }
}

/**
 * Search for memories with files in the database
 */
async function searchFileMemories(
  query: string,
  userId: string,
  projectId: string,
  limit: number,
): Promise<Memory[]> {
  const memoryService = new MemoryService();

  const results = await memoryService.findMemories(query, userId, projectId, {
    limit: limit * 2, // Get more results to filter for files
    searchMethods: ["semantic", "text"],
    onlyFileMemories: true,
  });

  // Filter to only include memories with files and then limit
  const fileMemories = results.combined
    .filter((memory) => memory.fileId) // Only memories with files
    .slice(0, limit);

  return fileMemories;
}

/**
 * Send a file associated with a memory
 */
async function sendMemoryFile(
  memory: Memory,
  context: GatewayContext,
  filesProcessed: Set<string>,
): Promise<SentFileInfo | null> {
  if (!memory.fileId || filesProcessed.has(memory.fileId)) {
    return null;
  }

  filesProcessed.add(memory.fileId);

  try {
    const fileService = new FileService();

    // Get file info
    const fileInfo = await fileService.getFileById(memory.fileId);
    if (!fileInfo) {
      console.log(`File not found: ${memory.fileId}`);
      return null;
    }

    // Download file content
    const fileBuffer = await fileService.downloadFile(memory.fileId);
    if (!fileBuffer) {
      console.log(`Could not download file: ${memory.fileId}`);
      return null;
    }

    // Determine file type from mimeType
    const fileType = getFileTypeFromMimeType(fileInfo.mimeType);

    // Prepare file data for sending
    const fileData = {
      buffer: fileBuffer,
      fileName: fileInfo.originalName,
      mimeType: fileInfo.mimeType,
      ...(fileInfo.fileSize && { size: fileInfo.fileSize }), // Only include size if it exists
    };

    // Send file using gateway
    await context.gateway.sendFile(context.originalContext, fileData, fileType);

    console.log(`✅ Sent file: ${fileInfo.originalName} (${fileType})`);

    // Return file info with proper optional handling
    const sentFileInfo: SentFileInfo = {
      fileName: fileInfo.originalName,
      fileType,
      mimeType: fileInfo.mimeType,
    };

    if (fileInfo.fileSize) {
      sentFileInfo.size = fileInfo.fileSize;
    }

    return sentFileInfo;
  } catch (fileError) {
    console.error(`Error sending file for memory ${memory.id}:`, fileError);
    return null;
  }
}

/**
 * Process file memories and optionally send associated files
 */
async function processFileMemoriesAndFiles(
  memories: Memory[],
  context: GatewayContext,
): Promise<{ textResults: string[]; sentFiles: SentFileInfo[] }> {
  const textResults: string[] = [];
  const sentFiles: SentFileInfo[] = [];
  const filesProcessed = new Set<string>(); // Prevent duplicate file sends

  for (let i = 0; i < memories.length; i++) {
    const memory = memories[i];
    if (!memory) continue; // Safety check

    textResults.push(`${i + 1}. ${memory.content} [📎 File attached]`);

    // Send associated file if requested and available
    const sentFile = await sendMemoryFile(memory, context, filesProcessed);

    if (sentFile) {
      sentFiles.push(sentFile);
    }
  }

  return { textResults, sentFiles };
}

/**
 * Generate the final response message including sent files info
 */
function generateResponseMessage(
  textResults: string[],
  sentFiles: SentFileInfo[],
  filterReasoning?: string,
): string {
  let response = textResults.join("\n");

  // Add information about sent files for AI awareness
  if (sentFiles.length > 0) {
    response += "\n\n---\n";
    response += `📎 **${sentFiles.length} file(s) retrieved and sent to user:**\n`;

    sentFiles.forEach((file, index) => {
      const sizeInfo = file.size ? ` (${Math.round(file.size / 1024)}KB)` : "";
      response += `${index + 1}. ${file.fileName} - ${file.fileType}${sizeInfo}\n`;
    });

    response += "\n*Note: Files have been successfully retrieved and sent to the user above.*";
  }

  // Add AI filtering reasoning if available
  if (filterReasoning) {
    response += `\n\n🤖 **File Filter Applied:** ${filterReasoning}`;
  }

  return response;
}

export const fileRetrieverTool = tool({
  name: "file_retriever",
  description:
    "Retrieves stored memories that have attached files and are relevant to the given query. Only returns memories with associated files (documents, images, audio, video, etc.).",
  parameters: FileRetrieverParams,
  strict: true,
  execute: async (data: FileRetrieverParams, runContext?: RunContext<GatewayContext>) => {
    const context = runContext?.context;
    if (!context) {
      return "⚠️ Missing database context; cannot retrieve files.";
    }

    // Extract database context (works for both DatabaseContext and GatewayContext)
    const dbCtx: DatabaseContext = {
      userId: context.userId,
      projectId: context.projectId,
      channelId: context.channelId,
    };

    const { query, limit } = data;

    try {
      // Step 1: Search for memories with files
      let memories = await searchFileMemories(query, dbCtx.userId, dbCtx.projectId, limit);

      if (memories.length === 0) {
        return "No matching files found in memories.";
      }

      // Step 2: Apply AI filtering if enabled
      const { filteredMemories, reasoning } = await filterMemoriesWithAI(query, memories);
      memories = filteredMemories;
      const filterReasoning = reasoning;

      // Step 3: Process file memories and send files
      const { textResults, sentFiles } = await processFileMemoriesAndFiles(memories, context);

      // Step 4: Generate response with file info and filter reasoning
      const response = generateResponseMessage(textResults, sentFiles, filterReasoning);
      return response;
    } catch (error) {
      console.error("Error in file retriever tool:", error);
      return "⚠️ Error occurred while retrieving files.";
    }
  },
});
