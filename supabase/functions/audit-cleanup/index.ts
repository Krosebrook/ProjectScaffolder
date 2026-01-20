// ProjectScaffolder - Audit Log Cleanup Edge Function
// Scheduled function to archive and cleanup old audit logs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Configuration
const CONFIG = {
  // Retention periods in days
  retention: {
    DEBUG: 7,    // 1 week
    INFO: 30,    // 1 month
    WARNING: 90, // 3 months
    ERROR: 365,  // 1 year
    CRITICAL: 730, // 2 years (regulatory compliance)
  },
  // Batch size for deletions
  batchSize: 1000,
  // Maximum execution time (ms)
  maxExecutionTime: 25000, // 25 seconds (leave buffer for Edge Function limit)
};

// Types
interface CleanupResult {
  severity: string;
  deleted: number;
  cutoffDate: string;
}

interface CleanupSummary {
  success: boolean;
  startTime: string;
  endTime: string;
  results: CleanupResult[];
  totalDeleted: number;
  archivedCount?: number;
  error?: string;
}

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Calculate cutoff date for a retention period
function getCutoffDate(days: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

// Archive logs before deletion (optional - exports to storage)
async function archiveLogsToStorage(
  logs: Record<string, unknown>[],
  archiveDate: string
): Promise<number> {
  if (logs.length === 0) return 0;

  try {
    const archiveData = JSON.stringify(logs, null, 2);
    const fileName = `audit-archive-${archiveDate}.json`;
    const filePath = `audit-archives/${new Date().getFullYear()}/${fileName}`;

    const { error } = await supabase.storage
      .from("backups")
      .upload(filePath, archiveData, {
        contentType: "application/json",
        upsert: true,
      });

    if (error) {
      console.error("Failed to archive logs:", error);
      return 0;
    }

    console.log(`Archived ${logs.length} logs to ${filePath}`);
    return logs.length;
  } catch (error) {
    console.error("Archive error:", error);
    return 0;
  }
}

// Delete logs by severity with cutoff date
async function deleteLogsBySeverity(
  severity: string,
  cutoffDate: Date,
  batchSize: number
): Promise<number> {
  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    // Select logs to delete
    const { data: logsToDelete, error: selectError } = await supabase
      .from("audit_logs")
      .select("id")
      .eq("severity", severity)
      .lt("created_at", cutoffDate.toISOString())
      .limit(batchSize);

    if (selectError) {
      console.error(`Error selecting ${severity} logs:`, selectError);
      break;
    }

    if (!logsToDelete || logsToDelete.length === 0) {
      hasMore = false;
      break;
    }

    const ids = logsToDelete.map((log) => log.id);

    // Delete the batch
    const { error: deleteError } = await supabase
      .from("audit_logs")
      .delete()
      .in("id", ids);

    if (deleteError) {
      console.error(`Error deleting ${severity} logs:`, deleteError);
      break;
    }

    totalDeleted += logsToDelete.length;
    console.log(`Deleted ${logsToDelete.length} ${severity} logs (total: ${totalDeleted})`);

    // If we got fewer than batch size, we're done
    if (logsToDelete.length < batchSize) {
      hasMore = false;
    }
  }

  return totalDeleted;
}

// Get logs to archive before deletion (CRITICAL and ERROR for compliance)
async function getLogsToArchive(cutoffDate: Date): Promise<Record<string, unknown>[]> {
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("*")
    .in("severity", ["CRITICAL", "ERROR"])
    .lt("created_at", cutoffDate.toISOString())
    .limit(5000); // Limit archive batch

  if (error) {
    console.error("Error fetching logs to archive:", error);
    return [];
  }

  return logs || [];
}

// Clean up expired verification tokens
async function cleanupVerificationTokens(): Promise<number> {
  const { data, error } = await supabase
    .from("verification_tokens")
    .delete()
    .lt("expires", new Date().toISOString())
    .select("identifier");

  if (error) {
    console.error("Error cleaning up verification tokens:", error);
    return 0;
  }

  return data?.length || 0;
}

// Clean up expired sessions
async function cleanupExpiredSessions(): Promise<number> {
  const { data, error } = await supabase
    .from("sessions")
    .delete()
    .lt("expires", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("Error cleaning up sessions:", error);
    return 0;
  }

  return data?.length || 0;
}

// Main cleanup function
async function performCleanup(): Promise<CleanupSummary> {
  const startTime = new Date();
  const results: CleanupResult[] = [];
  let totalDeleted = 0;
  let archivedCount = 0;

  try {
    console.log("Starting audit log cleanup...");

    // Archive CRITICAL/ERROR logs before their retention expires
    const archiveCutoff = getCutoffDate(CONFIG.retention.ERROR);
    const logsToArchive = await getLogsToArchive(archiveCutoff);

    if (logsToArchive.length > 0) {
      archivedCount = await archiveLogsToStorage(
        logsToArchive,
        archiveCutoff.toISOString().split("T")[0]
      );
    }

    // Process each severity level
    for (const [severity, days] of Object.entries(CONFIG.retention)) {
      const cutoffDate = getCutoffDate(days);

      // Check execution time
      if (Date.now() - startTime.getTime() > CONFIG.maxExecutionTime) {
        console.warn("Approaching execution time limit, stopping cleanup");
        break;
      }

      console.log(`Processing ${severity} logs (cutoff: ${cutoffDate.toISOString()})`);

      const deleted = await deleteLogsBySeverity(
        severity,
        cutoffDate,
        CONFIG.batchSize
      );

      results.push({
        severity,
        deleted,
        cutoffDate: cutoffDate.toISOString(),
      });

      totalDeleted += deleted;
    }

    // Cleanup other expired data
    console.log("Cleaning up expired tokens and sessions...");
    const tokensDeleted = await cleanupVerificationTokens();
    const sessionsDeleted = await cleanupExpiredSessions();

    console.log(`Deleted ${tokensDeleted} expired verification tokens`);
    console.log(`Deleted ${sessionsDeleted} expired sessions`);

    // Log the cleanup event
    await supabase.from("audit_logs").insert({
      action: "AUDIT_CLEANUP",
      resource: "AuditLog",
      details: {
        results,
        totalDeleted,
        archivedCount,
        tokensDeleted,
        sessionsDeleted,
        executionTimeMs: Date.now() - startTime.getTime(),
      },
      severity: "INFO",
      category: "system",
    });

    return {
      success: true,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      results,
      totalDeleted,
      archivedCount,
    };
  } catch (error) {
    console.error("Cleanup error:", error);

    // Log the error
    await supabase.from("audit_logs").insert({
      action: "AUDIT_CLEANUP_FAILED",
      resource: "AuditLog",
      details: {
        error: (error as Error).message,
        results,
        totalDeleted,
      },
      severity: "ERROR",
      category: "system",
    });

    return {
      success: false,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      results,
      totalDeleted,
      error: (error as Error).message,
    };
  }
}

// Serve the function
serve(async (req: Request) => {
  // Only allow POST requests (from Supabase cron or manual trigger)
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify authorization
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Parse optional configuration from request body
    const body = await req.json().catch(() => ({}));

    if (body.retention) {
      // Allow overriding retention periods (for testing)
      Object.assign(CONFIG.retention, body.retention);
    }

    if (body.batchSize) {
      CONFIG.batchSize = Math.min(body.batchSize, 5000);
    }

    // Perform the cleanup
    const summary = await performCleanup();

    return new Response(JSON.stringify(summary), {
      status: summary.success ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: (error as Error).message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
