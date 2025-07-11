import OpenAI from 'openai';
import { z } from 'zod';

export interface PhotoConfig {
  openaiApiKey: string;
}

export interface ImageFile {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  size: number | undefined;
}

// Zod schema for structured output validation
const PhotoAnalysisSchema = z.object({
  contentType: z.string().describe('Type of content (document, photo, chart, whiteboard, screenshot, etc.)'),
  extractedText: z.string().nullable().describe('All readable text from the image. If no text found, return null'),
  description: z.string().describe('Clear description of what is visible in the image'),
  keyInsights: z.array(z.string()).describe('3-5 most important points or insights about this image'),
  summary: z.string().describe('Concise summary that would help someone find this image later by describing its content, purpose, and key elements'),
});

export type PhotoResult = z.infer<typeof PhotoAnalysisSchema> & {
  confidence: number | undefined;
  error: string | undefined;
};

export class PhotoProcessor {
  private openai: OpenAI;

  constructor(config: PhotoConfig) {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  async analyzeImage(imageFile: ImageFile): Promise<PhotoResult> {
    try {
      console.log(`Analyzing image: ${imageFile.fileName} (${imageFile.mimeType})`);
      
      // Convert ArrayBuffer to base64 for OpenAI API
      const base64Image = this.arrayBufferToBase64(imageFile.buffer);
      
      // Vision models don't support structured outputs, so we use text formatting
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert image analyzer. Analyze images comprehensively and provide structured responses.

IMPORTANT: Respond ONLY with valid JSON in exactly this format:
{
  "contentType": "string - Type of content (document, photo, chart, whiteboard, screenshot, etc.)",
  "extractedText": "string or null - All readable text from the image. If no text found, use null",
  "description": "string - Clear description of what is visible in the image",
  "keyInsights": ["array of strings - 3-5 most important points or insights"],
  "summary": "string - Concise summary for search optimization"
}

For extracted text:
- Extract ALL readable text, including handwritten notes
- Maintain original formatting and structure
- Include numbers, dates, labels, and special characters
- If no text is visible, use null (not a string)

For description:
- Describe main objects, people, scenes
- Include colors, composition, setting
- Note activities or context
- Mention important visual elements

For key insights:
- Identify what's significant or noteworthy
- Include actionable information
- Note important data or findings
- Limit to 3-5 most important points

For summary:
- Create a concise summary optimized for search
- Include content type, purpose, and key elements
- Help future retrieval of this image

DO NOT include any text outside the JSON object.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image and provide structured information about it."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${imageFile.mimeType};base64,${base64Image}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.1,
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from vision analysis');
      }
      
      // Clean and parse the JSON response
      const analysis = this.parseVisionResponse(content);
      
      console.log(`✅ Successfully analyzed image: ${analysis.contentType} - "${analysis.summary.substring(0, 100)}..."`);
      
      return {
        ...analysis,
        confidence: 0.9, // Vision analysis generally reliable
        error: undefined,
      };
      
    } catch (error) {
      console.error('❌ Image analysis error:', error);
      
      return {
        contentType: 'unknown',
        extractedText: null,
        description: 'Failed to analyze image',
        keyInsights: [],
        summary: '[Image analysis failed]',
        confidence: undefined,
        error: error instanceof Error ? error.message : 'Unknown image analysis error',
      };
    }
  }

  private parseVisionResponse(content: string): z.infer<typeof PhotoAnalysisSchema> {
    try {
      // Clean the response - remove any markdown formatting
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Parse JSON
      const parsed = JSON.parse(cleanContent);
      
      // Validate with Zod schema
      const validated = PhotoAnalysisSchema.parse(parsed);
      
      return validated;
      
    } catch (parseError) {
      console.warn('Failed to parse vision response as JSON:', parseError);
      
      // Fallback: extract information from unstructured text
      return this.extractFromUnstructuredText(content);
    }
  }

  private extractFromUnstructuredText(content: string): z.infer<typeof PhotoAnalysisSchema> {
    // Fallback parsing for when JSON parsing fails
    const text = content.trim();
    
    return {
      contentType: 'unknown',
      extractedText: text.includes('no text') || text.includes('No text') ? null : text.substring(0, 500),
      description: text.substring(0, 300),
      keyInsights: [text.substring(0, 100)],
      summary: text.substring(0, 200),
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }

  // Utility method to check if a file type is supported
  isImageFile(mimeType: string): boolean {
    const supportedTypes = [
      'image/jpeg',     // JPEG
      'image/jpg',      // JPG
      'image/png',      // PNG
      'image/gif',      // GIF
      'image/webp',     // WebP
      'image/bmp',      // BMP
      'image/tiff',     // TIFF
    ];
    
    return supportedTypes.includes(mimeType.toLowerCase());
  }

  // Get max file size for image analysis (20MB OpenAI limit)
  getMaxFileSize(): number {
    return 20 * 1024 * 1024; // 20MB in bytes
  }
} 