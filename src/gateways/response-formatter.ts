import type { ProcessedMessage } from './types.js';

export class ResponseFormatter {
  formatResponse(processedMessage: ProcessedMessage): string {
    const { type, text, metadata } = processedMessage;
    
    switch (type) {
      case 'text':
        return `📝 **Message received:** "${text}"`;
      
      case 'voice':
        // Check if it was processed by transcript processor
        if (metadata.processingInfo?.processor === 'transcript') {
          if (metadata.processingInfo.error) {
            return `🎤 **Voice message received** (${metadata.processingInfo.duration || 'unknown'}s)\n` +
                   `❌ Transcription failed: ${metadata.processingInfo.error}\n\n` +
                   `I received your voice message but couldn't transcribe it. Please try again or send a text message.`;
          } else {
            return `🎤 **Voice message transcribed** (${metadata.processingInfo.duration || 'unknown'}s):\n\n` +
                   `"${text}"\n\n` +
                   `✅ Successfully processed using OpenAI Whisper`;
          }
        } else {
          return `🎤 Voice message received (${metadata.fileSize ? Math.round(metadata.fileSize / 1024) + 'KB' : 'unknown size'}). Transcription will be implemented soon!`;
        }
      
      case 'document':
        return `📄 **Document received:** "${metadata.fileName}" (${metadata.fileSize ? Math.round(metadata.fileSize / 1024) + 'KB' : 'unknown size'})\n\n` +
               `Document analysis will be implemented soon!`;
      
      case 'photo':
        // Check if it was processed by photo processor
        if (metadata.processingInfo?.processor === 'photo') {
          if (metadata.processingInfo.error) {
            return `📸 **Photo received** (${metadata.fileSize ? Math.round(metadata.fileSize / 1024) + 'KB' : 'unknown size'})\n` +
                   `❌ Analysis failed: ${metadata.processingInfo.error}\n\n` +
                   `I received your photo but couldn't analyze it. Please try again.`;
          } else {
            // Build rich response with structured data
            let response = `📸 **${metadata.processingInfo.contentType?.toUpperCase() || 'IMAGE'} Analyzed**\n\n`;
            
            // Add extracted text if available
            if (metadata.processingInfo.extractedText) {
              response += `📝 **Text Found:**\n${metadata.processingInfo.extractedText}\n\n`;
            }
            
            // Add description
            if (metadata.processingInfo.description) {
              response += `🔍 **Description:**\n${metadata.processingInfo.description}\n\n`;
            }
            
            // Add key insights if available
            if (metadata.processingInfo.keyInsights && metadata.processingInfo.keyInsights.length > 0) {
              response += `💡 **Key Insights:**\n`;
              metadata.processingInfo.keyInsights.forEach((insight: string, index: number) => {
                response += `${index + 1}. ${insight}\n`;
              });
              response += '\n';
            }
            
            response += `✅ Successfully analyzed using GPT-4 Vision`;
            return response;
          }
        } else {
          return `📸 **Photo received** (${metadata.fileSize ? Math.round(metadata.fileSize / 1024) + 'KB' : 'unknown size'})\n\n` +
                 `Image analysis will be implemented soon!`;
        }
      
      default:
        return `❓ **Unknown message type:** "${text}"`;
    }
  }
} 