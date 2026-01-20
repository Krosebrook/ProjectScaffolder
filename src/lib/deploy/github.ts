import { Octokit } from "@octokit/rest";
import simpleGit, { SimpleGit } from "simple-git";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch?: string;
  token?: string;
}

export interface CreateRepoOptions {
  name: string;
  description?: string;
  isPrivate?: boolean;
  autoInit?: boolean;
}

export interface PushFilesOptions {
  files: { path: string; content: string }[];
  commitMessage: string;
  branch?: string;
}

export class GitHubService {
  private octokit: Octokit;
  private git: SimpleGit;

  constructor(token?: string) {
    const authToken = token || process.env.GITHUB_TOKEN;
    if (!authToken) {
      throw new Error("GitHub token not configured");
    }

    this.octokit = new Octokit({ auth: authToken });
    this.git = simpleGit();
  }

  /**
   * Check if GitHub is configured
   */
  static isConfigured(): boolean {
    return !!process.env.GITHUB_TOKEN;
  }

  /**
   * Get authenticated user info
   */
  async getAuthenticatedUser() {
    const { data } = await this.octokit.users.getAuthenticated();
    return data;
  }

  /**
   * Create a new repository
   */
  async createRepository(options: CreateRepoOptions) {
    const { data } = await this.octokit.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.isPrivate ?? true,
      auto_init: options.autoInit ?? false,
    });

    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      url: data.html_url,
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
      defaultBranch: data.default_branch,
    };
  }

  /**
   * Check if a repository exists
   */
  async repoExists(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.repos.get({ owner, repo });
      return true;
    } catch (error: unknown) {
      if ((error as { status?: number }).status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Push files to a repository
   */
  async pushFiles(
    config: GitHubConfig,
    options: PushFilesOptions
  ): Promise<{ commitSha: string; url: string }> {
    const { owner, repo, branch = "main" } = config;
    const { files, commitMessage } = options;

    // Create a temporary directory for the git operations
    const tempDir = join(tmpdir(), `project-scaffolder-${Date.now()}`);

    try {
      await mkdir(tempDir, { recursive: true });

      // Initialize git repo
      const git = simpleGit(tempDir);
      await git.init();
      await git.addConfig("user.email", "project-scaffolder@example.com");
      await git.addConfig("user.name", "Project Scaffolder");

      // Write all files
      for (const file of files) {
        const filePath = join(tempDir, file.path);
        const dirPath = join(tempDir, file.path.split("/").slice(0, -1).join("/"));

        if (dirPath !== tempDir) {
          await mkdir(dirPath, { recursive: true });
        }
        await writeFile(filePath, file.content);
      }

      // Add and commit
      await git.add(".");
      await git.commit(commitMessage);

      // Add remote and push
      const token = process.env.GITHUB_TOKEN;
      const remoteUrl = `https://${token}@github.com/${owner}/${repo}.git`;
      await git.addRemote("origin", remoteUrl);

      // Check if branch exists, if not create it
      try {
        await git.push("origin", branch, ["--set-upstream"]);
      } catch {
        // If push fails, try force push for new repo
        await git.push("origin", branch, ["--set-upstream", "--force"]);
      }

      // Get the commit SHA
      const log = await git.log({ maxCount: 1 });
      const commitSha = log.latest?.hash || "";

      return {
        commitSha,
        url: `https://github.com/${owner}/${repo}`,
      };
    } finally {
      // Clean up temp directory
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Create or update a file in a repository
   */
  async createOrUpdateFile(
    config: GitHubConfig,
    path: string,
    content: string,
    message: string
  ) {
    const { owner, repo, branch = "main" } = config;

    // Check if file exists
    let sha: string | undefined;
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });
      if ("sha" in data) {
        sha = data.sha;
      }
    } catch {
      // File doesn't exist, that's fine
    }

    const { data } = await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString("base64"),
      branch,
      sha,
    });

    return {
      commitSha: data.commit.sha,
      url: data.content?.html_url,
    };
  }

  /**
   * Get repository info
   */
  async getRepository(owner: string, repo: string) {
    const { data } = await this.octokit.repos.get({ owner, repo });
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      url: data.html_url,
      cloneUrl: data.clone_url,
      defaultBranch: data.default_branch,
      isPrivate: data.private,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * List user repositories
   */
  async listRepositories(options?: { perPage?: number; page?: number }) {
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      per_page: options?.perPage || 30,
      page: options?.page || 1,
      sort: "updated",
    });

    return data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      isPrivate: repo.private,
      updatedAt: repo.updated_at,
    }));
  }
}
