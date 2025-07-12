import OpenAI from "openai";

export interface TranscriptConfig {
  openaiApiKey: string;
}

export interface AudioFile {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  duration: number | undefined;
}

export interface TranscriptResult {
  text: string;
  duration: number | undefined;
  confidence: number | undefined;
  error: string | undefined;
}

export class TranscriptProcessor {
  private openai: OpenAI;

  constructor(config: TranscriptConfig) {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  async transcribeAudio(audioFile: AudioFile): Promise<TranscriptResult> {
    try {
      console.log(`Transcribing audio file: ${audioFile.fileName} (${audioFile.mimeType})`);

      // Convert ArrayBuffer to File object for OpenAI API
      const file = new File([audioFile.buffer], audioFile.fileName, {
        type: audioFile.mimeType,
      });

      // Transcribe using OpenAI Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: "gpt-4o-mini-transcribe",
        // language: 'en', // Auto-detect language
        response_format: "json", // Get additional metadata
      });

      if (!transcription.text || transcription.text.trim().length === 0) {
        throw new Error("Empty transcription received");
      }

      console.log(`✅ Successfully transcribed: "${transcription.text.substring(0, 100)}..."`);

      return {
        text: transcription.text.trim(),
        duration: audioFile.duration,
        confidence: 1.0, // Transcription doesn't provide confidence scores
        error: undefined,
      };
    } catch (error) {
      console.error("❌ Transcription error:", error);

      return {
        text: "",
        duration: audioFile.duration,
        confidence: undefined,
        error: error instanceof Error ? error.message : "Unknown transcription error",
      };
    }
  }

  // Utility method to check if a file type is supported
  isAudioFile(mimeType: string): boolean {
    const supportedTypes = [
      "audio/mpeg", // MP3
      "audio/mp3", // MP3 (alternative)
      "audio/ogg", // OGG (Telegram voice)
      "audio/wav", // WAV
      "audio/m4a", // M4A
      "audio/aac", // AAC
      "audio/flac", // FLAC
      "audio/webm", // WebM
    ];

    return supportedTypes.includes(mimeType.toLowerCase());
  }

  // Get max file size for transcription (25MB Whisper limit)
  getMaxFileSize(): number {
    return 25 * 1024 * 1024; // 25MB in bytes
  }
}
