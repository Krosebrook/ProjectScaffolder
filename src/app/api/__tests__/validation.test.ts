import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Define the validation schemas (matching those in the API routes)
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  techStack: z.array(
    z.object({
      name: z.string(),
      category: z.enum(['frontend', 'backend', 'database', 'devops', 'other']),
      version: z.string().optional(),
    })
  ),
  prompt: z.string().max(10000).optional(),
});

const listProjectsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z
    .enum(['DRAFT', 'GENERATING', 'GENERATED', 'DEPLOYING', 'DEPLOYED', 'FAILED'])
    .optional(),
});

const generateSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(1).max(10000).optional(),
  provider: z.enum(['anthropic', 'openai', 'gemini']).optional(),
  model: z.string().optional(),
});

const deploySchema = z.object({
  projectId: z.string(),
  provider: z.enum(['vercel', 'netlify', 'github-pages']),
  envVariables: z.record(z.string(), z.string()).optional(),
});

describe('API Input Validation Schemas', () => {
  describe('createProjectSchema', () => {
    it('should accept valid project data', () => {
      const validData = {
        name: 'My Project',
        description: 'A test project',
        techStack: [
          { name: 'React', category: 'frontend', version: '18.0.0' },
          { name: 'Node.js', category: 'backend' },
        ],
        prompt: 'Build a todo application',
      };

      const result = createProjectSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('My Project');
        expect(result.data.techStack).toHaveLength(2);
      }
    });

    it('should accept minimal valid data', () => {
      const minimalData = {
        name: 'A',
        techStack: [],
      };

      const result = createProjectSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        techStack: [],
      };

      const result = createProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name');
      }
    });

    it('should reject name exceeding 100 characters', () => {
      const invalidData = {
        name: 'A'.repeat(101),
        techStack: [],
      };

      const result = createProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject description exceeding 1000 characters', () => {
      const invalidData = {
        name: 'Test',
        description: 'A'.repeat(1001),
        techStack: [],
      };

      const result = createProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid tech stack category', () => {
      const invalidData = {
        name: 'Test',
        techStack: [{ name: 'React', category: 'invalid-category' }],
      };

      const result = createProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept all valid tech stack categories', () => {
      const validCategories = ['frontend', 'backend', 'database', 'devops', 'other'];

      for (const category of validCategories) {
        const data = {
          name: 'Test',
          techStack: [{ name: 'Tech', category }],
        };

        const result = createProjectSchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it('should reject prompt exceeding 10000 characters', () => {
      const invalidData = {
        name: 'Test',
        techStack: [],
        prompt: 'A'.repeat(10001),
      };

      const result = createProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        description: 'Test description',
      };

      const result = createProjectSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('listProjectsSchema', () => {
    it('should accept valid pagination parameters', () => {
      const validData = {
        page: '2',
        pageSize: '50',
        status: 'DRAFT',
      };

      const result = listProjectsSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(50);
        expect(result.data.status).toBe('DRAFT');
      }
    });

    it('should use default values when not provided', () => {
      const result = listProjectsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
        expect(result.data.status).toBeUndefined();
      }
    });

    it('should coerce string numbers to numbers', () => {
      const data = {
        page: '5',
        pageSize: '25',
      };

      const result = listProjectsSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.page).toBe('number');
        expect(typeof result.data.pageSize).toBe('number');
      }
    });

    it('should reject page less than 1', () => {
      const invalidData = {
        page: '0',
      };

      const result = listProjectsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject pageSize greater than 100', () => {
      const invalidData = {
        pageSize: '101',
      };

      const result = listProjectsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept all valid status values', () => {
      const validStatuses = ['DRAFT', 'GENERATING', 'GENERATED', 'DEPLOYING', 'DEPLOYED', 'FAILED'];

      for (const status of validStatuses) {
        const result = listProjectsSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const invalidData = {
        status: 'INVALID_STATUS',
      };

      const result = listProjectsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('generateSchema', () => {
    it('should accept valid generation request', () => {
      const validData = {
        projectId: 'proj-123',
        prompt: 'Generate a React component',
        provider: 'anthropic',
        model: 'claude-3-sonnet',
      };

      const result = generateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept minimal valid data', () => {
      const minimalData = {
        projectId: 'proj-123',
      };

      const result = generateSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });

    it('should reject missing projectId', () => {
      const invalidData = {
        prompt: 'Test prompt',
      };

      const result = generateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept all valid providers', () => {
      const providers = ['anthropic', 'openai', 'gemini'];

      for (const provider of providers) {
        const data = {
          projectId: 'proj-123',
          provider,
        };

        const result = generateSchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid provider', () => {
      const invalidData = {
        projectId: 'proj-123',
        provider: 'invalid-provider',
      };

      const result = generateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject prompt exceeding 10000 characters', () => {
      const invalidData = {
        projectId: 'proj-123',
        prompt: 'A'.repeat(10001),
      };

      const result = generateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty prompt (min 1 char)', () => {
      const invalidData = {
        projectId: 'proj-123',
        prompt: '',
      };

      const result = generateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('deploySchema', () => {
    it('should accept valid deployment request', () => {
      const validData = {
        projectId: 'proj-123',
        provider: 'vercel',
        envVariables: {
          NODE_ENV: 'production',
          API_KEY: 'secret-key',
        },
      };

      const result = deploySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept minimal valid data', () => {
      const minimalData = {
        projectId: 'proj-123',
        provider: 'vercel',
      };

      const result = deploySchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });

    it('should reject missing projectId', () => {
      const invalidData = {
        provider: 'vercel',
      };

      const result = deploySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing provider', () => {
      const invalidData = {
        projectId: 'proj-123',
      };

      const result = deploySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept all valid providers', () => {
      const providers = ['vercel', 'netlify', 'github-pages'];

      for (const provider of providers) {
        const data = {
          projectId: 'proj-123',
          provider,
        };

        const result = deploySchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid provider', () => {
      const invalidData = {
        projectId: 'proj-123',
        provider: 'aws',
      };

      const result = deploySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept empty envVariables object', () => {
      const data = {
        projectId: 'proj-123',
        provider: 'vercel',
        envVariables: {},
      };

      const result = deploySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject non-string values in envVariables', () => {
      const invalidData = {
        projectId: 'proj-123',
        provider: 'vercel',
        envVariables: {
          KEY: 123, // should be string
        },
      };

      const result = deploySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge cases and security considerations', () => {
    it('should handle null values gracefully', () => {
      const result = createProjectSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should handle undefined values gracefully', () => {
      const result = createProjectSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it('should strip extra fields (unknown keys)', () => {
      const dataWithExtra = {
        name: 'Test',
        techStack: [],
        maliciousField: 'should be ignored',
      };

      const result = createProjectSchema.safeParse(dataWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect('maliciousField' in result.data).toBe(false);
      }
    });

    it('should handle special characters in strings', () => {
      const dataWithSpecialChars = {
        name: '<script>alert("xss")</script>',
        techStack: [],
        description: '"; DROP TABLE projects; --',
      };

      // Schema should accept these but application should sanitize on output
      const result = createProjectSchema.safeParse(dataWithSpecialChars);
      expect(result.success).toBe(true);
    });

    it('should handle unicode characters', () => {
      const dataWithUnicode = {
        name: 'My Project',
        techStack: [],
        description: 'Includes emojis and unicode characters',
      };

      const result = createProjectSchema.safeParse(dataWithUnicode);
      expect(result.success).toBe(true);
    });

    it('should handle very large but valid arrays', () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => ({
        name: `Tech ${i}`,
        category: 'other' as const,
      }));

      const data = {
        name: 'Test',
        techStack: largeArray,
      };

      const result = createProjectSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
