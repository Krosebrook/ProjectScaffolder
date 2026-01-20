import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { audit } from "@/lib/compliance";
import { z } from "zod";

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  techStack: z.array(
    z.object({
      name: z.string(),
      category: z.enum(["frontend", "backend", "database", "devops", "other"]),
      version: z.string().optional(),
    })
  ),
  prompt: z.string().max(10000).optional(),
});

const listProjectsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "GENERATING", "GENERATED", "DEPLOYING", "DEPLOYED", "FAILED"]).optional(),
});

/**
 * GET /api/projects - List user's projects
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const params = listProjectsSchema.parse({
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      status: searchParams.get("status"),
    });

    const where = {
      ownerId: session.user.id,
      ...(params.status && { status: params.status }),
    };

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          techStack: true,
          githubRepo: true,
          deploymentUrl: true,
          createdAt: true,
          updatedAt: true,
          lastDeployedAt: true,
          _count: {
            select: {
              deployments: true,
              codeGenerations: true,
            },
          },
        },
      }),
      db.project.count({ where }),
    ]);

    return NextResponse.json({
      items: projects,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    });
  } catch (error) {
    console.error("Error listing projects:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid parameters", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects - Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createProjectSchema.parse(body);

    const project = await db.project.create({
      data: {
        name: data.name,
        description: data.description,
        techStack: data.techStack,
        prompt: data.prompt,
        ownerId: session.user.id,
      },
    });

    await audit.create(session.user.id, "Project", project.id, {
      name: project.name,
      techStack: project.techStack,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
