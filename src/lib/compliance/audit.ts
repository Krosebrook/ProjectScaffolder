import { db } from "@/lib/db";
import { AuditSeverity } from "@prisma/client";
import { headers } from "next/headers";

export interface AuditLogParams {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  details?: Record<string, unknown>;
  severity?: AuditSeverity;
  category?: string;
}

/**
 * Get request metadata from headers
 */
async function getRequestMetadata() {
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    const realIp = headersList.get("x-real-ip");
    const userAgent = headersList.get("user-agent");
    const requestId = headersList.get("x-request-id");

    return {
      ipAddress: forwardedFor?.split(",")[0]?.trim() || realIp || "unknown",
      userAgent: userAgent || undefined,
      requestId: requestId || undefined,
    };
  } catch {
    return {
      ipAddress: "unknown",
      userAgent: undefined,
      requestId: undefined,
    };
  }
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: AuditLogParams) {
  const metadata = await getRequestMetadata();

  return db.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      oldValue: params.oldValue as object,
      newValue: params.newValue as object,
      details: params.details as object,
      severity: params.severity || "INFO",
      category: params.category,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      requestId: metadata.requestId,
    },
  });
}

/**
 * Audit log helper for CRUD operations
 */
export const audit = {
  create: async (
    userId: string | undefined,
    resource: string,
    resourceId: string,
    newValue: Record<string, unknown>,
    category?: string
  ) => {
    return createAuditLog({
      userId,
      action: "CREATE",
      resource,
      resourceId,
      newValue,
      category: category || "data_access",
    });
  },

  read: async (
    userId: string | undefined,
    resource: string,
    resourceId: string,
    details?: Record<string, unknown>
  ) => {
    return createAuditLog({
      userId,
      action: "READ",
      resource,
      resourceId,
      details,
      category: "data_access",
      severity: "DEBUG",
    });
  },

  update: async (
    userId: string | undefined,
    resource: string,
    resourceId: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>
  ) => {
    return createAuditLog({
      userId,
      action: "UPDATE",
      resource,
      resourceId,
      oldValue,
      newValue,
      category: "data_access",
    });
  },

  delete: async (
    userId: string | undefined,
    resource: string,
    resourceId: string,
    oldValue: Record<string, unknown>
  ) => {
    return createAuditLog({
      userId,
      action: "DELETE",
      resource,
      resourceId,
      oldValue,
      category: "data_access",
      severity: "WARNING",
    });
  },

  error: async (
    userId: string | undefined,
    resource: string,
    action: string,
    error: string,
    details?: Record<string, unknown>
  ) => {
    return createAuditLog({
      userId,
      action,
      resource,
      details: { ...details, error },
      category: "system",
      severity: "ERROR",
    });
  },

  security: async (
    userId: string | undefined,
    action: string,
    details: Record<string, unknown>
  ) => {
    return createAuditLog({
      userId,
      action,
      resource: "Security",
      details,
      category: "security",
      severity: "WARNING",
    });
  },
};

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(options: {
  userId?: string;
  resource?: string;
  action?: string;
  severity?: AuditSeverity;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  const {
    userId,
    resource,
    action,
    severity,
    category,
    startDate,
    endDate,
    page = 1,
    pageSize = 50,
  } = options;

  const where = {
    ...(userId && { userId }),
    ...(resource && { resource }),
    ...(action && { action }),
    ...(severity && { severity }),
    ...(category && { category }),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Export audit logs for compliance reporting
 */
export async function exportAuditLogs(options: {
  startDate: Date;
  endDate: Date;
  format?: "json" | "csv";
}) {
  const logs = await db.auditLog.findMany({
    where: {
      createdAt: {
        gte: options.startDate,
        lte: options.endDate,
      },
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  if (options.format === "csv") {
    const header =
      "ID,Timestamp,User Email,Action,Resource,Resource ID,Severity,Category,IP Address\n";
    const rows = logs
      .map(
        (log) =>
          `${log.id},${log.createdAt.toISOString()},${log.user?.email || ""},${log.action},${log.resource},${log.resourceId || ""},${log.severity},${log.category || ""},${log.ipAddress || ""}`
      )
      .join("\n");
    return header + rows;
  }

  return JSON.stringify(logs, null, 2);
}
