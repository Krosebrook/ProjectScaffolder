import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions
const mockGenerate = vi.fn();
const mockGenerateChat = vi.fn();

// Mock the provider modules with proper class constructors
vi.mock('../anthropic', () => {
  return {
    AnthropicProvider: class MockAnthropicProvider {
      name = 'anthropic' as const;
      isConfigured() { return true; }
      generate = mockGenerate;
      generateChat = mockGenerateChat;
    },
  };
});

vi.mock('../openai', () => {
  return {
    OpenAIProvider: class MockOpenAIProvider {
      name = 'openai' as const;
      isConfigured() { return true; }
      generate = mockGenerate;
      generateChat = mockGenerateChat;
    },
  };
});

vi.mock('../gemini', () => {
  return {
    GeminiProvider: class MockGeminiProvider {
      name = 'gemini' as const;
      isConfigured() { return true; }
      generate = mockGenerate;
      generateChat = mockGenerateChat;
    },
  };
});

// Import after mocking
import {
  getLLMProvider,
  getDefaultProvider,
  getConfiguredProviders,
  createCodeGenerationPrompt,
  parseCodeGenerationResponse,
  resetProviders,
} from '../index';

describe('LLM Provider Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset provider singletons before each test
    resetProviders();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getLLMProvider', () => {
    it('should return an Anthropic provider for "anthropic"', () => {
      const provider = getLLMProvider('anthropic');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('anthropic');
    });

    it('should return an OpenAI provider for "openai"', () => {
      const provider = getLLMProvider('openai');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('openai');
    });

    it('should return a Gemini provider for "gemini"', () => {
      const provider = getLLMProvider('gemini');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('gemini');
    });

    it('should return the same instance for multiple calls (singleton)', () => {
      const provider1 = getLLMProvider('anthropic');
      const provider2 = getLLMProvider('anthropic');
      expect(provider1).toBe(provider2);
    });

    it('should throw an error for unknown providers', () => {
      // @ts-expect-error Testing invalid provider
      expect(() => getLLMProvider('invalid')).toThrow('Unknown LLM provider: invalid');
    });
  });

  describe('getDefaultProvider', () => {
    it('should return anthropic provider as default when no env is set', () => {
      delete process.env.DEFAULT_LLM_PROVIDER;
      const provider = getDefaultProvider();
      expect(provider.name).toBe('anthropic');
    });

    it('should return the provider specified in DEFAULT_LLM_PROVIDER env', () => {
      resetProviders(); // Reset before setting new env
      process.env.DEFAULT_LLM_PROVIDER = 'openai';
      const provider = getDefaultProvider();
      expect(provider.name).toBe('openai');
    });
  });

  describe('getConfiguredProviders', () => {
    it('should return empty array when no API keys are configured', () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_AI_API_KEY;
      const providers = getConfiguredProviders();
      expect(providers).toEqual([]);
    });

    it('should include anthropic when ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_AI_API_KEY;
      const providers = getConfiguredProviders();
      expect(providers).toContain('anthropic');
    });

    it('should include openai when OPENAI_API_KEY is set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';
      delete process.env.GOOGLE_AI_API_KEY;
      const providers = getConfiguredProviders();
      expect(providers).toContain('openai');
    });

    it('should include gemini when GOOGLE_AI_API_KEY is set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      process.env.GOOGLE_AI_API_KEY = 'test-key';
      const providers = getConfiguredProviders();
      expect(providers).toContain('gemini');
    });

    it('should return all providers when all API keys are set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.GOOGLE_AI_API_KEY = 'test-key';
      const providers = getConfiguredProviders();
      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('gemini');
      expect(providers).toHaveLength(3);
    });
  });
});

describe('createCodeGenerationPrompt', () => {
  it('should create a prompt with project description and tech stack', () => {
    const prompt = createCodeGenerationPrompt(
      'Build a todo app',
      ['React', 'TypeScript', 'Tailwind']
    );

    expect(prompt).toContain('Build a todo app');
    expect(prompt).toContain('React, TypeScript, Tailwind');
    expect(prompt).toContain('Technology Stack');
    expect(prompt).toContain('Project Description');
  });

  it('should include additional instructions when provided', () => {
    const prompt = createCodeGenerationPrompt(
      'Build a todo app',
      ['React'],
      'Add dark mode support'
    );

    expect(prompt).toContain('Additional Instructions');
    expect(prompt).toContain('Add dark mode support');
  });

  it('should not include Additional Instructions section when not provided', () => {
    const prompt = createCodeGenerationPrompt(
      'Build a todo app',
      ['React']
    );

    expect(prompt).not.toContain('Additional Instructions');
  });

  it('should include requirements section', () => {
    const prompt = createCodeGenerationPrompt('Test', ['Node.js']);

    expect(prompt).toContain('Requirements');
    expect(prompt).toContain('proper error handling');
    expect(prompt).toContain('OWASP guidelines');
  });

  it('should include output format instructions', () => {
    const prompt = createCodeGenerationPrompt('Test', ['Node.js']);

    expect(prompt).toContain('Output Format');
    expect(prompt).toContain('JSON object');
    expect(prompt).toContain('"files" array');
  });
});

describe('parseCodeGenerationResponse', () => {
  it('should parse valid JSON response with files array', () => {
    const response = JSON.stringify({
      files: [
        { path: 'package.json', content: '{"name": "test"}' },
        { path: 'src/index.ts', content: 'console.log("hello")' },
      ],
    });

    const files = parseCodeGenerationResponse(response);

    expect(files).toHaveLength(2);
    expect(files[0]).toEqual({ path: 'package.json', content: '{"name": "test"}' });
    expect(files[1]).toEqual({ path: 'src/index.ts', content: 'console.log("hello")' });
  });

  it('should extract JSON from response with surrounding text', () => {
    const response = `Here is the generated code:

{
  "files": [
    { "path": "index.js", "content": "const x = 1;" }
  ]
}

That's the output!`;

    const files = parseCodeGenerationResponse(response);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('index.js');
  });

  it('should throw error when no JSON is found', () => {
    const response = 'This is just plain text without JSON';

    expect(() => parseCodeGenerationResponse(response)).toThrow(
      'Failed to parse generated code response'
    );
  });

  it('should throw error when files array is missing', () => {
    const response = JSON.stringify({ data: [] });

    expect(() => parseCodeGenerationResponse(response)).toThrow(
      'Failed to parse generated code response'
    );
  });

  it('should throw error when files is not an array', () => {
    const response = JSON.stringify({ files: 'not an array' });

    expect(() => parseCodeGenerationResponse(response)).toThrow(
      'Failed to parse generated code response'
    );
  });

  it('should handle empty files array', () => {
    const response = JSON.stringify({ files: [] });

    const files = parseCodeGenerationResponse(response);

    expect(files).toEqual([]);
  });

  it('should preserve file content with special characters', () => {
    const content = 'const str = "Hello\\nWorld";';
    const response = JSON.stringify({
      files: [{ path: 'test.js', content }],
    });

    const files = parseCodeGenerationResponse(response);

    expect(files[0].content).toBe(content);
  });
});
