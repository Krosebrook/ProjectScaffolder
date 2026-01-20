import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { audit } from "@/lib/compliance";
import {
  generate,
  createCodeGenerationPrompt,
  parseCodeGenerationResponse,
  LLMProvider,
} from "@/lib/ai";
import { z } from "zod";

const generateSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(1).max(10000).optional(),
  provider: z.enum(["anthropic", "openai", "gemini"]).optional(),
  model: z.string().optional(),
});

/**
 * POST /api/generate - Generate code for a project
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = generateSchema.parse(body);

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

    // Update project status
    await db.project.update({
      where: { id: project.id },
      data: { status: "GENERATING" },
    });

    // Create code generation record
    const codeGen = await db.codeGeneration.create({
      data: {
        projectId: project.id,
        prompt: data.prompt || project.prompt || "",
        model: data.model || "claude-sonnet-4-20250514",
        status: "PROCESSING",
      },
    });

    try {
      // Build the prompt
      const techStack = (project.techStack as Array<{ name: string }>).map(
        (t) => t.name
      );
      const fullPrompt = createCodeGenerationPrompt(
        `${project.name}\n\n${project.description || ""}\n\n${data.prompt || project.prompt || ""}`,
        techStack
      );

      // Generate code
      const result = await generate(fullPrompt, {
        provider: data.provider as LLMProvider,
        model: data.model,
        maxTokens: 8192,
        temperature: 0.7,
      });

      // Parse the response
      const files = parseCodeGenerationResponse(result.content);

      // Update code generation record
      await db.codeGeneration.update({
        where: { id: codeGen.id },
        data: {
          output: files,
          tokenUsage: {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
          },
          durationMs: result.durationMs,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // Update project with generated files
      await db.project.update({
        where: { id: project.id },
        data: {
          status: "GENERATED",
          generatedFiles: files,
        },
      });

      await audit.create(session.user.id, "CodeGeneration", codeGen.id, {
        projectId: project.id,
        model: result.model,
        filesGenerated: files.length,
      });

      return NextResponse.json({
        success: true,
        generationId: codeGen.id,
        files,
        usage: result.usage,
        durationMs: result.durationMs,
      });
    } catch (genError) {
      // Update records on failure
      await db.codeGeneration.update({
        where: { id: codeGen.id },
        data: {
          status: "FAILED",
          errorMessage:
            genError instanceof Error ? genError.message : "Unknown error",
        },
      });

      await db.project.update({
        where: { id: project.id },
        data: { status: "FAILED" },
      });

      await audit.error(
        session.user.id,
        "CodeGeneration",
        "GENERATE",
        genError instanceof Error ? genError.message : "Unknown error",
        { projectId: project.id, codeGenId: codeGen.id }
      );

      throw genError;
    }
  } catch (error) {
    console.error("Error generating code:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "Failed to generate code",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/generate?projectId=xxx - Get generation history
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

    const generations = await db.codeGeneration.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        model: true,
        status: true,
        tokenUsage: true,
        durationMs: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true,
      },
    });

    return NextResponse.json(generations);
  } catch (error) {
    console.error("Error getting generations:", error);
    return NextResponse.json(
      { error: "Failed to get generation history" },
      { status: 500 }
    );
  }
}
