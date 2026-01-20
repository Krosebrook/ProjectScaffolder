import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import {
  LLMProvider,
  LLMProviderInterface,
  GenerateOptions,
  GenerateResult,
  LLMMessage,
} from "./types";

export * from "./types";

// Provider instances (singletons)
let anthropicProvider: AnthropicProvider | null = null;
let openaiProvider: OpenAIProvider | null = null;
let geminiProvider: GeminiProvider | null = null;

/**
 * Reset all provider instances (for testing)
 */
export function resetProviders(): void {
  anthropicProvider = null;
  openaiProvider = null;
  geminiProvider = null;
}

/**
 * Get an LLM provider instance
 */
export function getLLMProvider(provider: LLMProvider): LLMProviderInterface {
  switch (provider) {
    case "anthropic":
      if (!anthropicProvider) {
        anthropicProvider = new AnthropicProvider();
      }
      return anthropicProvider;

    case "openai":
      if (!openaiProvider) {
        openaiProvider = new OpenAIProvider();
      }
      return openaiProvider;

    case "gemini":
      if (!geminiProvider) {
        geminiProvider = new GeminiProvider();
      }
      return geminiProvider;

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Get the default LLM provider based on environment configuration
 */
export function getDefaultProvider(): LLMProviderInterface {
  const defaultProvider =
    (process.env.DEFAULT_LLM_PROVIDER as LLMProvider) || "anthropic";
  return getLLMProvider(defaultProvider);
}

/**
 * Get a list of configured (available) providers
 */
export function getConfiguredProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push("anthropic");
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push("openai");
  }
  if (process.env.GOOGLE_AI_API_KEY) {
    providers.push("gemini");
  }

  return providers;
}

/**
 * Generate content using the specified or default provider
 */
export async function generate(
  prompt: string,
  options?: GenerateOptions & { provider?: LLMProvider }
): Promise<GenerateResult> {
  const provider = options?.provider
    ? getLLMProvider(options.provider)
    : getDefaultProvider();

  if (!provider.isConfigured()) {
    throw new Error(`Provider ${provider.name} is not configured`);
  }

  return provider.generate(prompt, options);
}

/**
 * Generate chat completion using the specified or default provider
 */
export async function generateChat(
  messages: LLMMessage[],
  options?: GenerateOptions & { provider?: LLMProvider }
): Promise<GenerateResult> {
  const provider = options?.provider
    ? getLLMProvider(options.provider)
    : getDefaultProvider();

  if (!provider.isConfigured()) {
    throw new Error(`Provider ${provider.name} is not configured`);
  }

  return provider.generateChat(messages, options);
}

/**
 * Code generation prompt template
 */
export function createCodeGenerationPrompt(
  projectDescription: string,
  techStack: string[],
  additionalInstructions?: string
): string {
  return `You are an expert software architect and developer. Generate a complete, production-ready project based on the following requirements.

## Project Description
${projectDescription}

## Technology Stack
${techStack.join(", ")}

## Requirements
1. Generate all necessary files with complete, working code
2. Include proper error handling and input validation
3. Follow best practices for the chosen technologies
4. Include necessary configuration files (package.json, tsconfig.json, etc.)
5. Add appropriate comments and documentation
6. Ensure the code is secure and follows OWASP guidelines

${additionalInstructions ? `## Additional Instructions\n${additionalInstructions}` : ""}

## Output Format
Respond with a JSON object containing a "files" array. Each file should have:
- "path": The relative file path (e.g., "src/index.ts")
- "content": The complete file content as a string

Example:
{
  "files": [
    { "path": "package.json", "content": "{...}" },
    { "path": "src/index.ts", "content": "..." }
  ]
}

Generate the project now:`;
}

/**
 * Parse code generation response to extract files
 */
export function parseCodeGenerationResponse(
  response: string
): { path: string; content: string }[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.files)) {
      throw new Error("Response does not contain files array");
    }

    return parsed.files.map((file: { path: string; content: string }) => ({
      path: file.path,
      content: file.content,
    }));
  } catch (error) {
    console.error("Failed to parse code generation response:", error);
    throw new Error("Failed to parse generated code response");
  }
}
