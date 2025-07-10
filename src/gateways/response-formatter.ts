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
        return `📸 **Photo received** (${metadata.fileSize ? Math.round(metadata.fileSize / 1024) + 'KB' : 'unknown size'})\n\n` +
               `Image analysis will be implemented soon!`;
      
      default:
        return `❓ **Unknown message type:** "${text}"`;
    }
  }
} 