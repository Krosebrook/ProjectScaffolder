import OpenAI from "openai";
import {
  LLMProviderInterface,
  LLMMessage,
  GenerateOptions,
  GenerateResult,
  DEFAULT_MODELS,
  DEFAULT_MAX_TOKENS,
} from "./types";

export class OpenAIProvider implements LLMProviderInterface {
  name = "openai" as const;
  private client: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      throw new Error("OpenAI API key not configured");
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

    const model = options?.model || DEFAULT_MODELS.openai;
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS.openai;

    // Convert messages to OpenAI format
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system prompt if provided
    if (options?.systemPrompt) {
      openaiMessages.push({
        role: "system",
        content: options.systemPrompt,
      });
    }

    // Add chat messages
    for (const msg of messages) {
      openaiMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    const response = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      max_tokens: maxTokens,
      temperature: options?.temperature ?? 0.7,
      stop: options?.stopSequences,
    });

    const choice = response.choices[0];
    const content = choice.message?.content || "";

    return {
      content,
      model,
      provider: "openai",
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      finishReason: choice.finish_reason || "stop",
      durationMs: Date.now() - startTime,
    };
  }
}
