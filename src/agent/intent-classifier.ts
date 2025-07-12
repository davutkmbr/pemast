import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { buildSystemPrompt } from "../utils/prompts.js";
import { readFile } from "../utils/read-file.js";

export type Intent = "upsert_fact" | "query_fact" | "store_memory" | "schedule_reminder" | "none";

// Minimal intent item: only what router needs
const IntentItem = z.object({
  intent: z.enum(["upsert_fact", "query_fact", "store_memory", "schedule_reminder", "none"]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1, "brief summary required"),
});

const IntentClassificationSchema = z.object({
  intents: z.array(IntentItem).min(1, "at least one intent required"),
  overall_summary: z.string().min(1, "overall summary required"),
});

export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

export class IntentClassifier {
  private openai: OpenAI;
  private model: string;
  private systemPrompt: Promise<string>;

  constructor(apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error("IntentClassifier: apiKey is not set");
    }

    if (!model || !process.env.UTILITY_MODEL) {
      throw new Error("IntentClassifier: model is not set");
    }

    this.openai = new OpenAI({ apiKey });
    this.model = model ?? process.env.UTILITY_MODEL;
    this.systemPrompt = this.loadSystemPrompt();
  }

  private async loadSystemPrompt(): Promise<string> {
    return buildSystemPrompt(await readFile("src/prompts/intent-classifier.md"));
  }

  /**
   * Classify a raw user message and return multiple structured intents.
   */
  async classify(messageText: string): Promise<IntentClassification> {
    // System + few-shot prompt examples
    const systemPrompt = await this.systemPrompt;

    const fewShotExamples: { role: "user" | "assistant"; content: string }[] = [
      {
        role: "user",
        content: "My favorite food is pizza and remind me to buy groceries tomorrow.",
      },
      {
        role: "assistant",
        content: JSON.stringify({
          intents: [
            { intent: "upsert_fact", confidence: 0.95, summary: "favorite food is pizza" },
            {
              intent: "schedule_reminder",
              confidence: 0.9,
              summary: "remind about groceries tomorrow",
            },
          ],
          overall_summary: "Food preference and grocery reminder",
        }),
      },
      {
        role: "user",
        content: "What is my favorite color?",
      },
      {
        role: "assistant",
        content: JSON.stringify({
          intents: [{ intent: "query_fact", confidence: 0.92, summary: "ask favorite color" }],
          overall_summary: "User is querying favorite color",
        }),
      },
      {
        role: "user",
        content: "Hi, how are you today?",
      },
      {
        role: "assistant",
        content: JSON.stringify({
          intents: [{ intent: "none", confidence: 0.9, summary: "casual greeting" }],
          overall_summary: "Casual greeting conversation",
        }),
      },
    ];

    const messages = [
      { role: "system", content: systemPrompt },
      ...fewShotExamples,
      { role: "user", content: messageText },
    ];

    const completion = await this.openai.chat.completions.parse({
      model: this.model,
      messages: messages as any,
      response_format: zodResponseFormat(IntentClassificationSchema, "intent_classification"),
    });

    const msg = completion.choices?.[0]?.message;
    if (!msg) {
      throw new Error("IntentClassifier: empty response");
    }

    if (msg.refusal) {
      throw new Error("IntentClassifier: model refused to classify");
    }

    const parsed = (msg as any).parsed as z.infer<typeof IntentClassificationSchema>;
    return parsed;
  }
}

export const intentClassifier = new IntentClassifier(process.env.OPENAI_API_KEY!);
