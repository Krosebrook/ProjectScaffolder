export type LLMProvider = "anthropic" | "openai" | "gemini";

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stopSequences?: string[];
}

export interface GenerateResult {
  content: string;
  model: string;
  provider: LLMProvider;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  durationMs: number;
}

export interface LLMProviderInterface {
  name: LLMProvider;
  generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;
  generateChat(
    messages: LLMMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult>;
  isConfigured(): boolean;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (result: GenerateResult) => void;
  onError?: (error: Error) => void;
}

// Default models for each provider
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4-turbo-preview",
  gemini: "gemini-pro",
};

// Max tokens defaults
export const DEFAULT_MAX_TOKENS: Record<LLMProvider, number> = {
  anthropic: 4096,
  openai: 4096,
  gemini: 2048,
};
