import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wand2, Github, Rocket, Shield, Zap, Code2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="h-6 w-6" />
            <span className="font-bold text-xl">ProjectScaffolder</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/auth/signin">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              AI-Powered Project Generation
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Generate complete, production-ready codebases in seconds.
              Enterprise-grade with full compliance capabilities.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/dashboard">
                  Start Building
                  <Wand2 className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-5 w-5" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-muted/50">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Everything you need to ship faster
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <Code2 className="h-10 w-10 mb-2 text-primary" />
                  <CardTitle>AI Code Generation</CardTitle>
                  <CardDescription>
                    Generate complete projects using Claude, GPT-4, or Gemini
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Rocket className="h-10 w-10 mb-2 text-primary" />
                  <CardTitle>One-Click Deploy</CardTitle>
                  <CardDescription>
                    Deploy to Vercel or push to GitHub with a single click
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Shield className="h-10 w-10 mb-2 text-primary" />
                  <CardTitle>Enterprise Compliance</CardTitle>
                  <CardDescription>
                    SOC 2 Type II and GDPR-ready with full audit logging
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Zap className="h-10 w-10 mb-2 text-primary" />
                  <CardTitle>Multi-Provider Support</CardTitle>
                  <CardDescription>
                    Choose your preferred AI provider for code generation
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Github className="h-10 w-10 mb-2 text-primary" />
                  <CardTitle>GitHub Integration</CardTitle>
                  <CardDescription>
                    Automatically create repos and push generated code
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Wand2 className="h-10 w-10 mb-2 text-primary" />
                  <CardTitle>Project Management</CardTitle>
                  <CardDescription>
                    Track projects, generations, and deployments in one place
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-2xl">
            <h2 className="text-3xl font-bold mb-4">
              Ready to transform your workflow?
            </h2>
            <p className="text-muted-foreground mb-8">
              Join developers who are shipping faster with AI-powered code generation.
            </p>
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Get Started for Free
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ProjectScaffolder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
