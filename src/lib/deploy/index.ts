import { DeploymentResult } from "@/types";
import { GitHubService } from "./github";
import { deployToVercel } from "./vercel";

export { GitHubService } from "./github";
export { VercelService, deployToVercel } from "./vercel";

export type DeploymentProvider = "vercel" | "netlify" | "github-pages";

export interface DeployOptions {
  provider: DeploymentProvider;
  projectName: string;
  files: { path: string; content: string }[];
  envVariables?: Record<string, string>;
  buildCommand?: string;
  outputDirectory?: string;
}

/**
 * Get list of configured deployment providers
 */
export function getConfiguredProviders(): DeploymentProvider[] {
  const providers: DeploymentProvider[] = [];

  if (process.env.VERCEL_TOKEN) {
    providers.push("vercel");
  }
  if (process.env.NETLIFY_TOKEN) {
    providers.push("netlify");
  }
  if (process.env.GITHUB_TOKEN) {
    providers.push("github-pages");
  }

  return providers;
}

/**
 * Deploy a project using the specified provider
 */
export async function deploy(
  options: DeployOptions
): Promise<DeploymentResult> {
  const { provider, projectName, envVariables, buildCommand, outputDirectory } =
    options;

  switch (provider) {
    case "vercel":
      return deployToVercel({
        provider: "vercel",
        projectName,
        envVariables,
        buildCommand,
        outputDirectory,
      });

    case "netlify":
      // TODO: Implement Netlify deployment
      return {
        success: false,
        error: "Netlify deployment not yet implemented",
      };

    case "github-pages":
      // TODO: Implement GitHub Pages deployment
      return {
        success: false,
        error: "GitHub Pages deployment not yet implemented",
      };

    default:
      return {
        success: false,
        error: `Unknown deployment provider: ${provider}`,
      };
  }
}

/**
 * Create a GitHub repository and push files
 */
export async function createAndPushToGitHub(options: {
  repoName: string;
  description?: string;
  files: { path: string; content: string }[];
  isPrivate?: boolean;
}): Promise<{
  success: boolean;
  repoUrl?: string;
  error?: string;
}> {
  try {
    const github = new GitHubService();

    // Get authenticated user
    const user = await github.getAuthenticatedUser();

    // Check if repo exists
    const exists = await github.repoExists(user.login, options.repoName);

    if (!exists) {
      // Create the repository
      await github.createRepository({
        name: options.repoName,
        description: options.description,
        isPrivate: options.isPrivate ?? true,
        autoInit: false,
      });
    }

    // Push files
    const result = await github.pushFiles(
      {
        owner: user.login,
        repo: options.repoName,
      },
      {
        files: options.files,
        commitMessage: "Initial commit from Project Scaffolder",
      }
    );

    return {
      success: true,
      repoUrl: result.url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Full deployment pipeline: Create repo -> Push code -> Deploy
 */
export async function fullDeploymentPipeline(options: {
  projectName: string;
  description?: string;
  files: { path: string; content: string }[];
  deployProvider: DeploymentProvider;
  envVariables?: Record<string, string>;
  isPrivate?: boolean;
}): Promise<{
  success: boolean;
  githubUrl?: string;
  deploymentUrl?: string;
  error?: string;
}> {
  // Step 1: Create GitHub repo and push code
  const githubResult = await createAndPushToGitHub({
    repoName: options.projectName,
    description: options.description,
    files: options.files,
    isPrivate: options.isPrivate,
  });

  if (!githubResult.success) {
    return {
      success: false,
      error: `GitHub setup failed: ${githubResult.error}`,
    };
  }

  // Step 2: Deploy to chosen provider
  const deployResult = await deploy({
    provider: options.deployProvider,
    projectName: options.projectName,
    files: options.files,
    envVariables: options.envVariables,
  });

  return {
    success: deployResult.success,
    githubUrl: githubResult.repoUrl,
    deploymentUrl: deployResult.url,
    error: deployResult.error,
  };
}
