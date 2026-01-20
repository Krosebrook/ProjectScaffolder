import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { audit } from "@/lib/compliance";
import { z } from "zod";

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  techStack: z
    .array(
      z.object({
        name: z.string(),
        category: z.enum(["frontend", "backend", "database", "devops", "other"]),
        version: z.string().optional(),
      })
    )
    .optional(),
  prompt: z.string().max(10000).optional(),
  envVariables: z.record(z.string(), z.string()).optional(),
});

/**
 * GET /api/projects/[id] - Get a single project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        deployments: {
          orderBy: { startedAt: "desc" },
          take: 5,
        },
        codeGenerations: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            model: true,
            status: true,
            tokenUsage: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check ownership (or admin role)
    if (project.ownerId !== session.user.id && session.user.role === "USER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await audit.read(session.user.id, "Project", project.id);

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error getting project:", error);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[id] - Update a project
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateProjectSchema.parse(body);

    // Get existing project
    const existing = await db.project.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check ownership
    if (existing.ownerId !== session.user.id && session.user.role === "USER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await db.project.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.techStack && { techStack: data.techStack }),
        ...(data.prompt !== undefined && { prompt: data.prompt }),
        ...(data.envVariables && { envVariables: data.envVariables }),
        version: { increment: 1 },
      },
    });

    await audit.update(
      session.user.id,
      "Project",
      project.id,
      { name: existing.name, description: existing.description },
      { name: project.name, description: project.description }
    );

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id] - Delete a project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check ownership
    if (project.ownerId !== session.user.id && session.user.role === "USER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.project.delete({
      where: { id },
    });

    await audit.delete(session.user.id, "Project", id, {
      name: project.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
