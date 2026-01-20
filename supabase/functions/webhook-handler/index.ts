// ProjectScaffolder - Webhook Handler Edge Function
// Processes incoming webhooks from GitHub, Vercel, and other services

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify as verifyWebhook } from "https://esm.sh/@octokit/webhooks-methods@4";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_WEBHOOK_SECRET = Deno.env.get("GITHUB_WEBHOOK_SECRET");
const VERCEL_WEBHOOK_SECRET = Deno.env.get("VERCEL_WEBHOOK_SECRET");

// Types
interface WebhookPayload {
  source: "github" | "vercel" | "netlify" | "stripe" | "unknown";
  event: string;
  data: Record<string, unknown>;
}

interface DeploymentUpdate {
  projectId: string;
  status: "PENDING" | "BUILDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  url?: string;
  errorMessage?: string;
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Verify GitHub webhook signature
async function verifyGitHubSignature(
  payload: string,
  signature: string | null
): Promise<boolean> {
  if (!signature || !GITHUB_WEBHOOK_SECRET) {
    console.error("Missing GitHub signature or secret");
    return false;
  }

  try {
    return await verifyWebhook(GITHUB_WEBHOOK_SECRET, payload, signature);
  } catch (error) {
    console.error("GitHub signature verification failed:", error);
    return false;
  }
}

// Verify Vercel webhook signature (HMAC-SHA1)
async function verifyVercelSignature(
  payload: string,
  signature: string | null
): Promise<boolean> {
  if (!signature || !VERCEL_WEBHOOK_SECRET) {
    console.error("Missing Vercel signature or secret");
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(VERCEL_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );

    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(sig)));

    return signature === computedSignature;
  } catch (error) {
    console.error("Vercel signature verification failed:", error);
    return false;
  }
}

// Parse webhook source from headers
function parseWebhookSource(headers: Headers): WebhookPayload["source"] {
  if (headers.get("x-github-event")) {
    return "github";
  }
  if (headers.get("x-vercel-signature")) {
    return "vercel";
  }
  if (headers.get("x-netlify-event")) {
    return "netlify";
  }
  if (headers.get("stripe-signature")) {
    return "stripe";
  }
  return "unknown";
}

// Handle GitHub webhooks
async function handleGitHubWebhook(
  event: string,
  payload: Record<string, unknown>
): Promise<Response> {
  console.log(`Processing GitHub event: ${event}`);

  switch (event) {
    case "push": {
      // Handle push events - could trigger rebuilds
      const repo = (payload.repository as { full_name?: string })?.full_name;
      const branch = (payload.ref as string)?.replace("refs/heads/", "");

      console.log(`Push to ${repo}/${branch}`);

      // Find projects linked to this repo
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, owner_id")
        .eq("github_repo", repo);

      if (projects && projects.length > 0) {
        // Log the webhook event
        await supabase.from("audit_logs").insert({
          action: "WEBHOOK_RECEIVED",
          resource: "Project",
          resource_id: projects[0].id,
          user_id: projects[0].owner_id,
          details: { event: "github.push", repo, branch },
          severity: "INFO",
          category: "integration",
        });
      }

      return new Response(JSON.stringify({ processed: true, event }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    case "repository": {
      // Handle repository events (created, deleted, etc.)
      const action = payload.action as string;
      const repo = (payload.repository as { full_name?: string })?.full_name;

      console.log(`Repository ${action}: ${repo}`);

      return new Response(JSON.stringify({ processed: true, event, action }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    default:
      console.log(`Unhandled GitHub event: ${event}`);
      return new Response(JSON.stringify({ processed: false, event }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
  }
}

// Handle Vercel webhooks
async function handleVercelWebhook(
  payload: Record<string, unknown>
): Promise<Response> {
  const type = payload.type as string;
  console.log(`Processing Vercel event: ${type}`);

  switch (type) {
    case "deployment.created":
    case "deployment.succeeded":
    case "deployment.failed":
    case "deployment.canceled": {
      const deployment = payload.payload as {
        deploymentId?: string;
        name?: string;
        url?: string;
        state?: string;
        meta?: { projectScaffolderProjectId?: string };
      };

      const projectId = deployment.meta?.projectScaffolderProjectId;

      if (!projectId) {
        console.log("No ProjectScaffolder project ID in deployment metadata");
        return new Response(JSON.stringify({ processed: false, reason: "no_project_id" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Map Vercel state to our status
      const statusMap: Record<string, DeploymentUpdate["status"]> = {
        BUILDING: "BUILDING",
        READY: "SUCCESS",
        ERROR: "FAILED",
        CANCELED: "CANCELLED",
      };

      const status = statusMap[deployment.state || ""] || "PENDING";
      const url = deployment.url ? `https://${deployment.url}` : undefined;

      // Update or create deployment record
      const { data: existingDeployment } = await supabase
        .from("deployments")
        .select("id")
        .eq("project_id", projectId)
        .eq("provider", "vercel")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (existingDeployment) {
        await supabase
          .from("deployments")
          .update({
            status,
            url,
            completed_at: status === "SUCCESS" || status === "FAILED" ? new Date().toISOString() : null,
          })
          .eq("id", existingDeployment.id);
      } else {
        await supabase.from("deployments").insert({
          project_id: projectId,
          status,
          provider: "vercel",
          url,
          started_at: new Date().toISOString(),
          completed_at: status === "SUCCESS" || status === "FAILED" ? new Date().toISOString() : null,
        });
      }

      // Update project status
      if (status === "SUCCESS") {
        await supabase
          .from("projects")
          .update({
            status: "DEPLOYED",
            deployment_url: url,
            last_deployed_at: new Date().toISOString(),
          })
          .eq("id", projectId);
      } else if (status === "FAILED") {
        await supabase
          .from("projects")
          .update({ status: "FAILED" })
          .eq("id", projectId);
      }

      // Log the event
      const { data: project } = await supabase
        .from("projects")
        .select("owner_id")
        .eq("id", projectId)
        .single();

      await supabase.from("audit_logs").insert({
        action: "DEPLOYMENT_STATUS_CHANGED",
        resource: "Deployment",
        resource_id: existingDeployment?.id,
        user_id: project?.owner_id,
        details: { event: type, status, url },
        severity: status === "FAILED" ? "WARNING" : "INFO",
        category: "deployment",
      });

      return new Response(JSON.stringify({ processed: true, status }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    default:
      console.log(`Unhandled Vercel event: ${type}`);
      return new Response(JSON.stringify({ processed: false, type }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
  }
}

// Main handler
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-GitHub-Event, X-GitHub-Delivery, X-Hub-Signature-256, X-Vercel-Signature",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();
    const headers = req.headers;
    const source = parseWebhookSource(headers);

    console.log(`Received webhook from: ${source}`);

    // Verify webhook signatures
    switch (source) {
      case "github": {
        const signature = headers.get("x-hub-signature-256");
        const isValid = await verifyGitHubSignature(body, signature);
        if (!isValid) {
          console.error("Invalid GitHub webhook signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const event = headers.get("x-github-event") || "unknown";
        const payload = JSON.parse(body);
        return await handleGitHubWebhook(event, payload);
      }

      case "vercel": {
        const signature = headers.get("x-vercel-signature");
        const isValid = await verifyVercelSignature(body, signature);
        if (!isValid) {
          console.error("Invalid Vercel webhook signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const payload = JSON.parse(body);
        return await handleVercelWebhook(payload);
      }

      case "netlify": {
        // Netlify webhook handling
        const payload = JSON.parse(body);
        console.log("Netlify webhook received:", payload);
        return new Response(JSON.stringify({ processed: true, source: "netlify" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      case "stripe": {
        // Stripe webhook handling (for future billing integration)
        console.log("Stripe webhook received");
        return new Response(JSON.stringify({ processed: true, source: "stripe" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      default:
        console.warn("Unknown webhook source");
        return new Response(JSON.stringify({ error: "Unknown webhook source" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: (error as Error).message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
