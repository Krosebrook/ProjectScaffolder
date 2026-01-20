import type {
  User,
  Project,
  Deployment,
  CodeGeneration,
  AuditLog,
  Role,
  ProjectStatus,
  DeploymentStatus,
  GenerationStatus,
  AuditSeverity,
} from "@prisma/client";

// Re-export Prisma types
export type {
  User,
  Project,
  Deployment,
  CodeGeneration,
  AuditLog,
  Role,
  ProjectStatus,
  DeploymentStatus,
  GenerationStatus,
  AuditSeverity,
};

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Project types
export interface TechStackItem {
  name: string;
  category: "frontend" | "backend" | "database" | "devops" | "other";
  version?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language?: string;
}

export interface FileTree {
  name: string;
  type: "file" | "directory";
  children?: FileTree[];
  content?: string;
}

// LLM types
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
}

export interface GenerateResult {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  finishReason: string;
}

// Deployment types
export interface DeploymentConfig {
  provider: "vercel" | "netlify" | "github-pages";
  projectName: string;
  envVariables?: Record<string, string>;
  buildCommand?: string;
  outputDirectory?: string;
}

export interface DeploymentResult {
  success: boolean;
  url?: string;
  deploymentId?: string;
  logs?: string[];
  error?: string;
}

// Auth types
export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
}

// Audit types
export interface AuditLogEntry {
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

// API Request types
export interface CreateProjectRequest {
  name: string;
  description?: string;
  techStack: TechStackItem[];
  prompt?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  techStack?: TechStackItem[];
  prompt?: string;
  envVariables?: Record<string, string>;
}

export interface GenerateCodeRequest {
  projectId: string;
  prompt: string;
  provider?: LLMProvider;
  model?: string;
}

export interface DeployRequest {
  projectId: string;
  provider: "vercel" | "netlify" | "github-pages";
  envVariables?: Record<string, string>;
}
