import { db } from "@/lib/db";
import { DSRType } from "@prisma/client";
import { randomBytes } from "crypto";
import { audit } from "./audit";

/**
 * Create a Data Subject Request
 */
export async function createDataSubjectRequest(params: {
  email: string;
  requestType: DSRType;
}) {
  const verificationToken = randomBytes(32).toString("hex");

  const request = await db.dataSubjectRequest.create({
    data: {
      email: params.email,
      requestType: params.requestType,
      verificationToken,
      status: "PENDING",
    },
  });

  await audit.create(undefined, "DataSubjectRequest", request.id, {
    email: params.email,
    requestType: params.requestType,
  });

  return {
    id: request.id,
    verificationToken,
  };
}

/**
 * Verify a Data Subject Request
 */
export async function verifyDataSubjectRequest(token: string) {
  const request = await db.dataSubjectRequest.findUnique({
    where: { verificationToken: token },
  });

  if (!request) {
    return { success: false, error: "Invalid verification token" };
  }

  if (request.status !== "PENDING") {
    return { success: false, error: "Request already processed" };
  }

  await db.dataSubjectRequest.update({
    where: { id: request.id },
    data: {
      status: "VERIFIED",
      verifiedAt: new Date(),
    },
  });

  return { success: true, requestId: request.id };
}

/**
 * Process a Data Subject Access Request (DSAR)
 */
export async function processAccessRequest(requestId: string) {
  const request = await db.dataSubjectRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || request.status !== "VERIFIED") {
    throw new Error("Invalid or unverified request");
  }

  await db.dataSubjectRequest.update({
    where: { id: requestId },
    data: { status: "PROCESSING" },
  });

  // Gather all user data
  const user = await db.user.findUnique({
    where: { email: request.email },
    include: {
      projects: true,
      auditLogs: {
        take: 1000,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const consentRecords = await db.consentRecord.findMany({
    where: { email: request.email },
  });

  // Mark as completed
  await db.dataSubjectRequest.update({
    where: { id: requestId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  return {
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          role: user.role,
        }
      : null,
    projects: user?.projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
    })),
    auditLogs: user?.auditLogs.map((log) => ({
      action: log.action,
      resource: log.resource,
      createdAt: log.createdAt,
      ipAddress: log.ipAddress,
    })),
    consentRecords: consentRecords.map((c) => ({
      purpose: c.purpose,
      granted: c.granted,
      createdAt: c.createdAt,
      revokedAt: c.revokedAt,
    })),
  };
}

/**
 * Process a Deletion Request (Right to be Forgotten)
 */
export async function processDeletionRequest(
  requestId: string,
  processedBy: string
) {
  const request = await db.dataSubjectRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || request.status !== "VERIFIED") {
    throw new Error("Invalid or unverified request");
  }

  await db.dataSubjectRequest.update({
    where: { id: requestId },
    data: { status: "PROCESSING" },
  });

  const user = await db.user.findUnique({
    where: { email: request.email },
  });

  if (user) {
    // Delete user data (cascades to related records)
    await db.user.delete({
      where: { id: user.id },
    });

    await audit.delete(processedBy, "User", user.id, {
      email: user.email,
      reason: "GDPR deletion request",
      requestId,
    });
  }

  // Delete consent records
  await db.consentRecord.deleteMany({
    where: { email: request.email },
  });

  // Anonymize audit logs (keep for compliance but remove PII)
  await db.auditLog.updateMany({
    where: { user: { email: request.email } },
    data: {
      userId: null,
      ipAddress: null,
      userAgent: null,
    },
  });

  await db.dataSubjectRequest.update({
    where: { id: requestId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      processedBy,
      notes: "User data deleted, audit logs anonymized",
    },
  });

  return { success: true };
}

/**
 * Record consent
 */
export async function recordConsent(params: {
  userId?: string;
  email: string;
  purpose: string;
  granted: boolean;
  method: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const consent = await db.consentRecord.create({
    data: {
      userId: params.userId,
      email: params.email,
      purpose: params.purpose,
      granted: params.granted,
      method: params.method,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  await audit.create(params.userId, "ConsentRecord", consent.id, {
    purpose: params.purpose,
    granted: params.granted,
  });

  return consent;
}

/**
 * Revoke consent
 */
export async function revokeConsent(params: {
  userId?: string;
  email: string;
  purpose: string;
}) {
  // Find the most recent consent record
  const consent = await db.consentRecord.findFirst({
    where: {
      email: params.email,
      purpose: params.purpose,
      granted: true,
      revokedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!consent) {
    return { success: false, error: "No active consent found" };
  }

  await db.consentRecord.update({
    where: { id: consent.id },
    data: { revokedAt: new Date() },
  });

  await audit.update(
    params.userId,
    "ConsentRecord",
    consent.id,
    { granted: true },
    { granted: false, revokedAt: new Date() }
  );

  return { success: true };
}

/**
 * Check if user has valid consent for a purpose
 */
export async function hasValidConsent(
  email: string,
  purpose: string
): Promise<boolean> {
  const consent = await db.consentRecord.findFirst({
    where: {
      email,
      purpose,
      granted: true,
      revokedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  return !!consent;
}

/**
 * Get user's consent status for all purposes
 */
export async function getUserConsentStatus(email: string) {
  const consents = await db.consentRecord.findMany({
    where: {
      email,
      revokedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  const statusMap: Record<string, { granted: boolean; date: Date }> = {};

  for (const consent of consents) {
    if (!statusMap[consent.purpose]) {
      statusMap[consent.purpose] = {
        granted: consent.granted,
        date: consent.createdAt,
      };
    }
  }

  return statusMap;
}
