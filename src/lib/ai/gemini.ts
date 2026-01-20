import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import {
  LLMProviderInterface,
  LLMMessage,
  GenerateOptions,
  GenerateResult,
  DEFAULT_MODELS,
  DEFAULT_MAX_TOKENS,
} from "./types";

export class GeminiProvider implements LLMProviderInterface {
  name = "gemini" as const;
  private client: GoogleGenerativeAI | null = null;

  constructor() {
    if (process.env.GOOGLE_AI_API_KEY) {
      this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      throw new Error("Google AI API key not configured");
    }
    return this.client;
  }

  async generate(
    prompt: string,
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    return this.generateChat(
      [{ role: "user", content: prompt }],
      options
    );
  }

  async generateChat(
    messages: LLMMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const client = this.getClient();
    const startTime = Date.now();

    const model = options?.model || DEFAULT_MODELS.gemini;
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS.gemini;

    const generativeModel = client.getGenerativeModel({
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: options?.temperature ?? 0.7,
        stopSequences: options?.stopSequences,
      },
    });

    // Convert messages to Gemini format
    const history: Content[] = [];
    let systemInstruction = options?.systemPrompt;

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = msg.content;
        continue;
      }

      history.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // Get the last user message for the prompt
    const lastUserMessage = messages
      .filter((m) => m.role === "user")
      .pop();

    if (!lastUserMessage) {
      throw new Error("No user message provided");
    }

    // Create chat with history (excluding last message)
    const chat = generativeModel.startChat({
      history: history.slice(0, -1),
      systemInstruction,
    });

    const result = await chat.sendMessage(lastUserMessage.content);
    const response = result.response;
    const content = response.text();

    // Gemini doesn't provide detailed token counts in all cases
    const inputTokens = messages.reduce(
      (acc, m) => acc + Math.ceil(m.content.length / 4),
      0
    );
    const outputTokens = Math.ceil(content.length / 4);

    return {
      content,
      model,
      provider: "gemini",
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      finishReason: response.candidates?.[0]?.finishReason || "STOP",
      durationMs: Date.now() - startTime,
    };
  }
}
