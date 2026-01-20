"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Wand2 } from "lucide-react";

const TECH_CATEGORIES = [
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "database", label: "Database" },
  { id: "devops", label: "DevOps" },
  { id: "other", label: "Other" },
] as const;

const POPULAR_TECH = [
  { name: "React", category: "frontend" },
  { name: "Next.js", category: "frontend" },
  { name: "TypeScript", category: "frontend" },
  { name: "Tailwind CSS", category: "frontend" },
  { name: "Node.js", category: "backend" },
  { name: "Express", category: "backend" },
  { name: "Python", category: "backend" },
  { name: "FastAPI", category: "backend" },
  { name: "PostgreSQL", category: "database" },
  { name: "MongoDB", category: "database" },
  { name: "Redis", category: "database" },
  { name: "Prisma", category: "database" },
  { name: "Docker", category: "devops" },
  { name: "Vercel", category: "devops" },
  { name: "GitHub Actions", category: "devops" },
] as const;

type TechCategory = (typeof TECH_CATEGORIES)[number]["id"];

interface TechItem {
  name: string;
  category: TechCategory;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [techStack, setTechStack] = useState<TechItem[]>([]);
  const [customTech, setCustomTech] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TechCategory>("frontend");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addTech = (tech: TechItem) => {
    if (!techStack.find((t) => t.name === tech.name)) {
      setTechStack([...techStack, tech]);
    }
  };

  const removeTech = (name: string) => {
    setTechStack(techStack.filter((t) => t.name !== name));
  };

  const addCustomTech = () => {
    if (customTech.trim()) {
      addTech({ name: customTech.trim(), category: selectedCategory });
      setCustomTech("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          prompt,
          techStack,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create project");
      }

      const project = await response.json();
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Create New Project
          </CardTitle>
          <CardDescription>
            Describe your project and let AI generate the code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Project"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your project..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tech Stack</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {techStack.map((tech) => (
                  <Badge
                    key={tech.name}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeTech(tech.name)}
                  >
                    {tech.name}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as TechCategory)}
                >
                  {TECH_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={customTech}
                  onChange={(e) => setCustomTech(e.target.value)}
                  placeholder="Add technology..."
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTech())}
                />
                <Button type="button" variant="outline" onClick={addCustomTech}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {POPULAR_TECH.filter(
                  (t) => !techStack.find((s) => s.name === t.name)
                ).map((tech) => (
                  <Badge
                    key={tech.name}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => addTech(tech)}
                  >
                    + {tech.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Detailed Requirements (Optional)
              </label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the features, functionality, and any specific requirements for your project..."
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !name || techStack.length === 0}>
                {isSubmitting ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
