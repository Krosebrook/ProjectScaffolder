"use client";

import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { ExternalLink, GitBranch, Rocket, Clock, Layers } from "lucide-react";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    status: ProjectStatus;
    techStack: unknown;
    githubRepo?: string | null;
    deploymentUrl?: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    lastDeployedAt?: Date | string | null;
    _count?: {
      deployments: number;
      codeGenerations: number;
    };
  };
}

const statusConfig: Record<ProjectStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  GENERATING: { label: "Generating", variant: "warning" },
  GENERATED: { label: "Generated", variant: "default" },
  DEPLOYING: { label: "Deploying", variant: "warning" },
  DEPLOYED: { label: "Deployed", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
};

export function ProjectCard({ project }: ProjectCardProps) {
  const status = statusConfig[project.status];
  const techStack = project.techStack as Array<{ name: string }> | null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold">
            <Link
              href={`/dashboard/projects/${project.id}`}
              className="hover:underline"
            >
              {project.name}
            </Link>
          </CardTitle>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {techStack && techStack.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {techStack.slice(0, 4).map((tech) => (
              <Badge key={tech.name} variant="outline" className="text-xs">
                {tech.name}
              </Badge>
            ))}
            {techStack.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{techStack.length - 4}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {project._count && (
            <>
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {project._count.codeGenerations} generations
              </span>
              <span className="flex items-center gap-1">
                <Rocket className="h-3 w-3" />
                {project._count.deployments} deployments
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Updated {formatRelativeTime(project.updatedAt)}
        </div>
      </CardContent>

      <CardFooter className="pt-3 gap-2">
        {project.githubRepo && (
          <Button variant="outline" size="sm" asChild>
            <a href={project.githubRepo} target="_blank" rel="noopener noreferrer">
              <GitBranch className="h-4 w-4 mr-1" />
              GitHub
            </a>
          </Button>
        )}
        {project.deploymentUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={project.deploymentUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Live
            </a>
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild className="ml-auto">
          <Link href={`/dashboard/projects/${project.id}`}>
            View Details
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
