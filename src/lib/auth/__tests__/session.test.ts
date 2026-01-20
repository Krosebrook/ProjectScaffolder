import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import {
  getSession,
  getCurrentUser,
  requireAuth,
  requireRole,
  hasRole,
  isAdmin,
  isEnterpriseAdmin,
} from '../session';
import type { SessionUser } from '@/types';

// Mock next-auth getServerSession
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// Mock the auth config
vi.mock('../config', () => ({
  authOptions: {},
}));

const mockGetServerSession = vi.mocked(getServerSession);
const mockRedirect = vi.mocked(redirect);

describe('Auth Session Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSession', () => {
    it('should return session when user is authenticated', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER' as const,
        },
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await getSession();

      expect(session).toEqual(mockSession);
      expect(mockGetServerSession).toHaveBeenCalled();
    });

    it('should return null when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const session = await getSession();

      expect(session).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user when session exists', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER' as const,
      };

      mockGetServerSession.mockResolvedValue({ user: mockUser });

      const user = await getCurrentUser();

      expect(user).toEqual(mockUser);
    });

    it('should return null when session does not exist', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const user = await getCurrentUser();

      expect(user).toBeNull();
    });

    it('should return null when session has no user', async () => {
      mockGetServerSession.mockResolvedValue({ user: undefined } as never);

      const user = await getCurrentUser();

      expect(user).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER' as const,
      };

      mockGetServerSession.mockResolvedValue({ user: mockUser });

      const user = await requireAuth();

      expect(user).toEqual(mockUser);
    });

    it('should redirect to signin when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow('REDIRECT:/auth/signin');
      expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
    });
  });

  describe('requireRole', () => {
    it('should return user when role matches (single role)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN' as const,
      };

      mockGetServerSession.mockResolvedValue({ user: mockUser });

      const user = await requireRole('ADMIN');

      expect(user).toEqual(mockUser);
    });

    it('should return user when role is in allowed roles array', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN' as const,
      };

      mockGetServerSession.mockResolvedValue({ user: mockUser });

      const user = await requireRole(['USER', 'ADMIN']);

      expect(user).toEqual(mockUser);
    });

    it('should throw error when role does not match', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'USER' as const,
      };

      mockGetServerSession.mockResolvedValue({ user: mockUser });

      await expect(requireRole('ADMIN')).rejects.toThrow('Forbidden: Insufficient permissions');
    });

    it('should throw error when role is not in allowed roles array', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'USER' as const,
      };

      mockGetServerSession.mockResolvedValue({ user: mockUser });

      await expect(requireRole(['ADMIN', 'ENTERPRISE_ADMIN'])).rejects.toThrow(
        'Forbidden: Insufficient permissions'
      );
    });

    it('should redirect to signin when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(requireRole('USER')).rejects.toThrow('REDIRECT:/auth/signin');
    });
  });

  describe('hasRole', () => {
    it('should return true when user has the specified role', () => {
      const user: SessionUser = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      };

      expect(hasRole(user, 'ADMIN')).toBe(true);
    });

    it('should return true when user role is in allowed roles array', () => {
      const user: SessionUser = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      };

      expect(hasRole(user, ['USER', 'ADMIN'])).toBe(true);
    });

    it('should return false when user does not have the specified role', () => {
      const user: SessionUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'USER',
      };

      expect(hasRole(user, 'ADMIN')).toBe(false);
    });

    it('should return false when user is null', () => {
      expect(hasRole(null, 'USER')).toBe(false);
    });

    it('should return false when user role is not in allowed roles array', () => {
      const user: SessionUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'USER',
      };

      expect(hasRole(user, ['ADMIN', 'ENTERPRISE_ADMIN'])).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for ADMIN role', () => {
      const user: SessionUser = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      };

      expect(isAdmin(user)).toBe(true);
    });

    it('should return true for ENTERPRISE_ADMIN role', () => {
      const user: SessionUser = {
        id: 'user-1',
        email: 'enterprise@example.com',
        name: 'Enterprise Admin',
        role: 'ENTERPRISE_ADMIN',
      };

      expect(isAdmin(user)).toBe(true);
    });

    it('should return false for USER role', () => {
      const user: SessionUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'USER',
      };

      expect(isAdmin(user)).toBe(false);
    });

    it('should return false for null user', () => {
      expect(isAdmin(null)).toBe(false);
    });
  });

  describe('isEnterpriseAdmin', () => {
    it('should return true for ENTERPRISE_ADMIN role', () => {
      const user: SessionUser = {
        id: 'user-1',
        email: 'enterprise@example.com',
        name: 'Enterprise Admin',
        role: 'ENTERPRISE_ADMIN',
      };

      expect(isEnterpriseAdmin(user)).toBe(true);
    });

    it('should return false for ADMIN role', () => {
      const user: SessionUser = {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      };

      expect(isEnterpriseAdmin(user)).toBe(false);
    });

    it('should return false for USER role', () => {
      const user: SessionUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'USER',
      };

      expect(isEnterpriseAdmin(user)).toBe(false);
    });

    it('should return false for null user', () => {
      expect(isEnterpriseAdmin(null)).toBe(false);
    });
  });
});
