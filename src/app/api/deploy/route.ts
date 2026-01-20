import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { audit } from "@/lib/compliance";
import { fullDeploymentPipeline, getConfiguredProviders } from "@/lib/deploy";
import { z } from "zod";

const deploySchema = z.object({
  projectId: z.string(),
  provider: z.enum(["vercel", "netlify", "github-pages"]),
  envVariables: z.record(z.string(), z.string()).optional(),
  createGitHubRepo: z.boolean().default(true),
  isPrivate: z.boolean().default(true),
});

/**
 * POST /api/deploy - Deploy a project
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = deploySchema.parse(body);

    // Check if provider is configured
    const configuredProviders = getConfiguredProviders();
    if (!configuredProviders.includes(data.provider)) {
      return NextResponse.json(
        { error: `Provider ${data.provider} is not configured` },
        { status: 400 }
      );
    }

    // Get the project
    const project = await db.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check ownership
    if (project.ownerId !== session.user.id && session.user.role === "USER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if project has generated files
    if (!project.generatedFiles || project.status !== "GENERATED") {
      return NextResponse.json(
        { error: "Project must have generated code before deployment" },
        { status: 400 }
      );
    }

    // Update project status
    await db.project.update({
      where: { id: project.id },
      data: { status: "DEPLOYING" },
    });

    // Create deployment record
    const deployment = await db.deployment.create({
      data: {
        projectId: project.id,
        provider: data.provider,
        status: "PENDING",
      },
    });

    try {
      // Update deployment status to building
      await db.deployment.update({
        where: { id: deployment.id },
        data: { status: "BUILDING" },
      });

      const files = project.generatedFiles as Array<{
        path: string;
        content: string;
      }>;

      // Deploy
      const result = await fullDeploymentPipeline({
        projectName: project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        description: project.description || undefined,
        files,
        deployProvider: data.provider,
        envVariables: data.envVariables,
        isPrivate: data.isPrivate,
      });

      if (result.success) {
        // Update deployment record
        await db.deployment.update({
          where: { id: deployment.id },
          data: {
            status: "SUCCESS",
            url: result.deploymentUrl,
            completedAt: new Date(),
          },
        });

        // Update project
        await db.project.update({
          where: { id: project.id },
          data: {
            status: "DEPLOYED",
            deploymentUrl: result.deploymentUrl,
            githubRepo: result.githubUrl,
            lastDeployedAt: new Date(),
          },
        });

        await audit.create(session.user.id, "Deployment", deployment.id, {
          projectId: project.id,
          provider: data.provider,
          url: result.deploymentUrl,
          githubUrl: result.githubUrl,
        });

        return NextResponse.json({
          success: true,
          deploymentId: deployment.id,
          deploymentUrl: result.deploymentUrl,
          githubUrl: result.githubUrl,
        });
      } else {
        throw new Error(result.error || "Deployment failed");
      }
    } catch (deployError) {
      // Update records on failure
      await db.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "FAILED",
          errorMessage:
            deployError instanceof Error
              ? deployError.message
              : "Unknown error",
          completedAt: new Date(),
        },
      });

      await db.project.update({
        where: { id: project.id },
        data: { status: "FAILED" },
      });

      await audit.error(
        session.user.id,
        "Deployment",
        "DEPLOY",
        deployError instanceof Error ? deployError.message : "Unknown error",
        { projectId: project.id, deploymentId: deployment.id }
      );

      throw deployError;
    }
  } catch (error) {
    console.error("Error deploying:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "Failed to deploy",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/deploy?projectId=xxx - Get deployment history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.ownerId !== session.user.id && session.user.role === "USER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deployments = await db.deployment.findMany({
      where: { projectId },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json(deployments);
  } catch (error) {
    console.error("Error getting deployments:", error);
    return NextResponse.json(
      { error: "Failed to get deployment history" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/deploy/providers - Get configured deployment providers
 */
export async function OPTIONS() {
  const providers = getConfiguredProviders();
  return NextResponse.json({ providers });
}
