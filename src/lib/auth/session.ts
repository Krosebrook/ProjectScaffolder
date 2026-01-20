import { getServerSession } from "next-auth";
import { authOptions } from "./config";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { SessionUser } from "@/types";

/**
 * Get the current session on the server
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Get the current user from session
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Require authentication - redirects to signin if not authenticated
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/signin");
  }
  return user;
}

/**
 * Require specific role(s) - throws error if user doesn't have required role
 */
export async function requireRole(roles: Role | Role[]): Promise<SessionUser> {
  const user = await requireAuth();
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return user;
}

/**
 * Check if user has specific role
 */
export function hasRole(user: SessionUser | null, roles: Role | Role[]): boolean {
  if (!user) return false;
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return allowedRoles.includes(user.role);
}

/**
 * Check if user is admin
 */
export function isAdmin(user: SessionUser | null): boolean {
  return hasRole(user, ["ADMIN", "ENTERPRISE_ADMIN"]);
}

/**
 * Check if user is enterprise admin
 */
export function isEnterpriseAdmin(user: SessionUser | null): boolean {
  return hasRole(user, "ENTERPRISE_ADMIN");
}
