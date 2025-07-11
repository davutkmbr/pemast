import type { ProcessedMessage } from '../types/index.js';

export class ResponseFormatter {
  formatResponse(processedMessage: ProcessedMessage): string {
    const { messageType, content, fileReference, processingMetadata } = processedMessage;
    
    switch (messageType) {
      case 'text':
        return `📝 **Message received:** "${content}"`;
      
      case 'voice':
        // Check if it was processed by transcript processor
        if (processingMetadata?.processor === 'transcript') {
          if (processingMetadata.error) {
            return `🎤 **Voice message received** (${processingMetadata.duration || 'unknown'}s)\n` +
                   `❌ Transcription failed: ${processingMetadata.error}\n\n` +
                   `I received your voice message but couldn't transcribe it. Please try again or send a text message.`;
          } else {
            return `🎤 **Voice message transcribed** (${processingMetadata.duration || 'unknown'}s):\n\n` +
                   `"${content}"\n\n` +
                   `✅ Successfully processed using OpenAI Whisper`;
          }
        } else {
          const fileSize = fileReference?.fileSize;
          return `🎤 Voice message received (${fileSize ? Math.round(fileSize / 1024) + 'KB' : 'unknown size'}). Transcription will be implemented soon!`;
        }
      
      case 'document':
        const fileName = fileReference?.fileName || 'unknown';
        const fileSize = fileReference?.fileSize;
        return `📄 **Document received:** "${fileName}" (${fileSize ? Math.round(fileSize / 1024) + 'KB' : 'unknown size'})\n\n` +
               `Document analysis will be implemented soon!`;
      
      case 'photo':
        // Check if it was processed by photo processor
        if (processingMetadata?.processor === 'photo') {
          if (processingMetadata.error) {
            const photoFileSize = fileReference?.fileSize;
            return `📸 **Photo received** (${photoFileSize ? Math.round(photoFileSize / 1024) + 'KB' : 'unknown size'})\n` +
                   `❌ Analysis failed: ${processingMetadata.error}\n\n` +
                   `I received your photo but couldn't analyze it. Please try again.`;
          } else {
            // Build rich response with structured data
            let response = `📸 **${processingMetadata.contentType?.toUpperCase() || 'IMAGE'} Analyzed**\n\n`;
            
            // Add extracted text if available
            if (processingMetadata.extractedText) {
              response += `📝 **Text Found:**\n${processingMetadata.extractedText}\n\n`;
            }
            
            // Add description
            if (processingMetadata.description) {
              response += `🔍 **Description:**\n${processingMetadata.description}\n\n`;
            }
            
            // Add key insights if available
            if (processingMetadata.keyInsights && Array.isArray(processingMetadata.keyInsights)) {
              response += `💡 **Key Insights:**\n`;
              processingMetadata.keyInsights.forEach((insight: string, index: number) => {
                response += `${index + 1}. ${insight}\n`;
              });
              response += '\n';
            }
            
            response += `✅ Successfully analyzed using GPT-4 Vision`;
            return response;
          }
        } else {
          const photoFileSize = fileReference?.fileSize;
          return `📸 **Photo received** (${photoFileSize ? Math.round(photoFileSize / 1024) + 'KB' : 'unknown size'})\n\n` +
                 `Image analysis will be implemented soon!`;
        }
      
      default:
        return `❓ **Unknown message type:** "${content}"`;
    }
  }
} 