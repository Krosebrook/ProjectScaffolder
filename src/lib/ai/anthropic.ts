import Anthropic from "@anthropic-ai/sdk";
import {
  LLMProviderInterface,
  LLMMessage,
  GenerateOptions,
  GenerateResult,
  DEFAULT_MODELS,
  DEFAULT_MAX_TOKENS,
} from "./types";

export class AnthropicProvider implements LLMProviderInterface {
  name = "anthropic" as const;
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      throw new Error("Anthropic API key not configured");
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

    const model = options?.model || DEFAULT_MODELS.anthropic;
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS.anthropic;

    // Separate system message from other messages
    const systemMessage = messages.find((m) => m.role === "system")?.content;
    const chatMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Add system prompt from options if not in messages
    const system = options?.systemPrompt || systemMessage;

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: options?.temperature ?? 0.7,
      system,
      messages: chatMessages,
      stop_sequences: options?.stopSequences,
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    return {
      content,
      model,
      provider: "anthropic",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason || "end_turn",
      durationMs: Date.now() - startTime,
    };
  }
}
