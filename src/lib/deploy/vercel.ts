import { DeploymentConfig, DeploymentResult } from "@/types";

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  framework?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VercelDeployment {
  id: string;
  url: string;
  state: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
  createdAt: number;
  buildingAt?: number;
  readyAt?: number;
}

export class VercelService {
  private apiUrl = "https://api.vercel.com";
  private token: string;

  constructor(token?: string) {
    const authToken = token || process.env.VERCEL_TOKEN;
    if (!authToken) {
      throw new Error("Vercel token not configured");
    }
    this.token = authToken;
  }

  /**
   * Check if Vercel is configured
   */
  static isConfigured(): boolean {
    return !!process.env.VERCEL_TOKEN;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Vercel API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    return response.json();
  }

  /**
   * Get authenticated user info
   */
  async getUser() {
    return this.request<{
      user: {
        id: string;
        email: string;
        name: string;
        username: string;
      };
    }>("/v2/user");
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<VercelProject[]> {
    const data = await this.request<{ projects: VercelProject[] }>(
      "/v9/projects"
    );
    return data.projects;
  }

  /**
   * Get a project by name or ID
   */
  async getProject(nameOrId: string): Promise<VercelProject | null> {
    try {
      return await this.request<VercelProject>(`/v9/projects/${nameOrId}`);
    } catch (error: unknown) {
      if ((error as Error).message?.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new project
   */
  async createProject(options: {
    name: string;
    framework?: string;
    gitRepository?: {
      type: "github";
      repo: string; // format: owner/repo
    };
    buildCommand?: string;
    outputDirectory?: string;
    installCommand?: string;
  }): Promise<VercelProject> {
    return this.request<VercelProject>("/v10/projects", {
      method: "POST",
      body: JSON.stringify({
        name: options.name,
        framework: options.framework || "nextjs",
        gitRepository: options.gitRepository,
        buildCommand: options.buildCommand,
        outputDirectory: options.outputDirectory,
        installCommand: options.installCommand,
      }),
    });
  }

  /**
   * Set environment variables for a project
   */
  async setEnvironmentVariables(
    projectId: string,
    envVars: Record<string, string>,
    target: ("production" | "preview" | "development")[] = [
      "production",
      "preview",
    ]
  ): Promise<void> {
    const variables = Object.entries(envVars).map(([key, value]) => ({
      key,
      value,
      target,
      type: "plain" as const,
    }));

    await this.request(`/v10/projects/${projectId}/env`, {
      method: "POST",
      body: JSON.stringify(variables),
    });
  }

  /**
   * Trigger a deployment
   */
  async deploy(options: {
    projectId: string;
    gitSource?: {
      type: "github";
      ref: string; // branch or commit SHA
      repoId: number;
    };
    target?: "production" | "preview";
  }): Promise<VercelDeployment> {
    const body: Record<string, unknown> = {
      name: options.projectId,
      target: options.target || "production",
    };

    if (options.gitSource) {
      body.gitSource = options.gitSource;
    }

    return this.request<VercelDeployment>("/v13/deployments", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Get deployment status
   */
  async getDeployment(deploymentId: string): Promise<VercelDeployment> {
    return this.request<VercelDeployment>(`/v13/deployments/${deploymentId}`);
  }

  /**
   * Wait for deployment to complete
   */
  async waitForDeployment(
    deploymentId: string,
    timeout = 300000 // 5 minutes
  ): Promise<VercelDeployment> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const deployment = await this.getDeployment(deploymentId);

      if (deployment.state === "READY") {
        return deployment;
      }

      if (deployment.state === "ERROR" || deployment.state === "CANCELED") {
        throw new Error(`Deployment failed with state: ${deployment.state}`);
      }

      // Wait 5 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error("Deployment timed out");
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.request(`/v9/projects/${projectId}`, {
      method: "DELETE",
    });
  }
}

/**
 * Deploy a project to Vercel
 */
export async function deployToVercel(
  config: DeploymentConfig
): Promise<DeploymentResult> {
  try {
    const vercel = new VercelService();

    // Check if project exists, create if not
    let project = await vercel.getProject(config.projectName);
    if (!project) {
      project = await vercel.createProject({
        name: config.projectName,
        buildCommand: config.buildCommand,
        outputDirectory: config.outputDirectory,
      });
    }

    // Set environment variables if provided
    if (config.envVariables) {
      await vercel.setEnvironmentVariables(project.id, config.envVariables);
    }

    // Trigger deployment
    const deployment = await vercel.deploy({
      projectId: project.id,
      target: "production",
    });

    // Wait for deployment to complete
    const finalDeployment = await vercel.waitForDeployment(deployment.id);

    return {
      success: true,
      url: `https://${finalDeployment.url}`,
      deploymentId: finalDeployment.id,
      logs: [],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
