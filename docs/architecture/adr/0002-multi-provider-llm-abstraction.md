# ADR-0002: Multi-Provider LLM Abstraction Layer

## Status

Accepted

## Date

2024-01-15

## Context

ProjectScaffolder's core functionality is AI-powered code generation. We need to:
- Support multiple AI providers (Anthropic, OpenAI, Google)
- Allow users to choose their preferred provider
- Handle provider failures gracefully
- Track usage and costs per provider
- Make it easy to add new providers in the future

The question is how to structure the integration with these providers.

## Decision

Implement a provider abstraction layer using the Strategy pattern.

**Key implementation details:**

```typescript
// Interface all providers implement
interface LLMProviderInterface {
  name: string;
  isConfigured(): boolean;
  generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;
  generateChat(messages: LLMMessage[], options?: GenerateOptions): Promise<GenerateResult>;
}

// Factory function for provider selection
function getLLMProvider(provider: LLMProvider): LLMProviderInterface;

// Default provider based on environment
function getDefaultProvider(): LLMProviderInterface;
```

**File structure:**
```
src/lib/ai/
├── index.ts       # Factory and utilities
├── types.ts       # Shared interfaces
├── anthropic.ts   # Claude implementation
├── openai.ts      # GPT implementation
└── gemini.ts      # Gemini implementation
```

## Consequences

### Positive

- **Flexibility**: Users can choose their preferred AI provider
- **Resilience**: Can fall back to alternative providers
- **Vendor independence**: No lock-in to a single provider
- **Extensibility**: Easy to add new providers (Mistral, Llama, etc.)
- **Testing**: Can mock providers for unit tests
- **Cost optimization**: Can route to cheaper providers for some tasks

### Negative

- **Complexity**: More code to maintain than single provider
- **Feature parity**: Providers have different capabilities
- **Prompt engineering**: May need provider-specific prompts
- **Response parsing**: Different response formats to normalize

### Neutral

- Need to keep SDKs updated for all providers
- Usage tracking per provider adds overhead

## Alternatives Considered

### Single Provider (Anthropic Only)

Use only Claude for all code generation.

**Rejected because:**
- Single point of failure
- No flexibility for users with existing API keys
- Vendor lock-in concerns

### LangChain

Use LangChain framework for provider abstraction.

**Rejected because:**
- Heavy dependency for simple use case
- Abstractions too generic for our needs
- Bundle size concerns
- Less control over prompt formatting

### Vercel AI SDK

Use Vercel's AI SDK for provider abstraction.

**Considered but deferred:**
- Good option but relatively new
- Our abstraction is simpler for current needs
- May migrate to this in future

## Implementation Notes

### Adding a New Provider

1. Create `src/lib/ai/newprovider.ts`
2. Implement `LLMProviderInterface`
3. Add to factory in `index.ts`
4. Add environment variable check in `getConfiguredProviders()`
5. Update types in `types.ts`

### Provider-Specific Considerations

| Provider | Max Tokens | Best For |
|----------|-----------|----------|
| Claude | 4096 | Complex code, reasoning |
| GPT-4 | 4096 | General purpose |
| Gemini | 2048 | Cost-effective tasks |

## References

- [Anthropic SDK Documentation](https://docs.anthropic.com/)
- [OpenAI SDK Documentation](https://platform.openai.com/docs/)
- [Google Generative AI Documentation](https://ai.google.dev/docs)
- [Strategy Pattern](https://refactoring.guru/design-patterns/strategy)
