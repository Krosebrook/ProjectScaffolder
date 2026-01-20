"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Settings, User } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-xl font-bold">
              ProjectScaffolder
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/projects"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Projects
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button asChild size="sm">
              <Link href="/dashboard/projects/new">
                <Plus className="h-4 w-4 mr-1" />
                New Project
              </Link>
            </Button>

            {session?.user && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
                <div className="flex items-center gap-2 px-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm hidden md:inline">
                    {session.user.name || session.user.email}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
