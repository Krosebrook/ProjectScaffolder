import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuditLog, audit, getAuditLogs, exportAuditLogs } from '../audit';
import { db } from '@/lib/db';

// Get the mocked db
const mockDb = vi.mocked(db);

describe('Audit Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAuditLog', () => {
    it('should create an audit log entry with required fields', async () => {
      const mockAuditLog = {
        id: 'audit-1',
        userId: 'user-1',
        action: 'CREATE',
        resource: 'Project',
        resourceId: 'proj-1',
        severity: 'INFO',
        createdAt: new Date(),
      };

      mockDb.auditLog.create.mockResolvedValue(mockAuditLog as never);

      const result = await createAuditLog({
        userId: 'user-1',
        action: 'CREATE',
        resource: 'Project',
        resourceId: 'proj-1',
      });

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'CREATE',
          resource: 'Project',
          resourceId: 'proj-1',
          severity: 'INFO',
          ipAddress: expect.any(String),
        }),
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('should include optional fields when provided', async () => {
      mockDb.auditLog.create.mockResolvedValue({} as never);

      await createAuditLog({
        userId: 'user-1',
        action: 'UPDATE',
        resource: 'Project',
        resourceId: 'proj-1',
        oldValue: { name: 'Old Name' },
        newValue: { name: 'New Name' },
        details: { reason: 'User requested' },
        severity: 'WARNING',
        category: 'data_access',
      });

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          oldValue: { name: 'Old Name' },
          newValue: { name: 'New Name' },
          details: { reason: 'User requested' },
          severity: 'WARNING',
          category: 'data_access',
        }),
      });
    });

    it('should default severity to INFO when not provided', async () => {
      mockDb.auditLog.create.mockResolvedValue({} as never);

      await createAuditLog({
        action: 'READ',
        resource: 'Project',
      });

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'INFO',
        }),
      });
    });

    it('should capture request metadata from headers', async () => {
      mockDb.auditLog.create.mockResolvedValue({} as never);

      await createAuditLog({
        action: 'CREATE',
        resource: 'Project',
      });

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          requestId: 'test-request-id',
        }),
      });
    });
  });

  describe('audit helper functions', () => {
    describe('audit.create', () => {
      it('should create audit log with CREATE action', async () => {
        mockDb.auditLog.create.mockResolvedValue({} as never);

        await audit.create('user-1', 'Project', 'proj-1', { name: 'Test Project' });

        expect(mockDb.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'CREATE',
            resource: 'Project',
            resourceId: 'proj-1',
            newValue: { name: 'Test Project' },
            category: 'data_access',
          }),
        });
      });

      it('should use custom category when provided', async () => {
        mockDb.auditLog.create.mockResolvedValue({} as never);

        await audit.create('user-1', 'Project', 'proj-1', {}, 'system');

        expect(mockDb.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            category: 'system',
          }),
        });
      });
    });

    describe('audit.read', () => {
      it('should create audit log with READ action and DEBUG severity', async () => {
        mockDb.auditLog.create.mockResolvedValue({} as never);

        await audit.read('user-1', 'Project', 'proj-1', { fields: ['name', 'description'] });

        expect(mockDb.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'READ',
            severity: 'DEBUG',
            category: 'data_access',
            details: { fields: ['name', 'description'] },
          }),
        });
      });
    });

    describe('audit.update', () => {
      it('should create audit log with UPDATE action and old/new values', async () => {
        mockDb.auditLog.create.mockResolvedValue({} as never);

        await audit.update(
          'user-1',
          'Project',
          'proj-1',
          { name: 'Old Name' },
          { name: 'New Name' }
        );

        expect(mockDb.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'UPDATE',
            oldValue: { name: 'Old Name' },
            newValue: { name: 'New Name' },
            category: 'data_access',
          }),
        });
      });
    });

    describe('audit.delete', () => {
      it('should create audit log with DELETE action and WARNING severity', async () => {
        mockDb.auditLog.create.mockResolvedValue({} as never);

        await audit.delete('user-1', 'Project', 'proj-1', { name: 'Deleted Project' });

        expect(mockDb.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'DELETE',
            severity: 'WARNING',
            oldValue: { name: 'Deleted Project' },
            category: 'data_access',
          }),
        });
      });
    });

    describe('audit.error', () => {
      it('should create audit log with ERROR severity', async () => {
        mockDb.auditLog.create.mockResolvedValue({} as never);

        await audit.error('user-1', 'Project', 'CREATE', 'Database connection failed', {
          projectId: 'proj-1',
        });

        expect(mockDb.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'CREATE',
            resource: 'Project',
            severity: 'ERROR',
            category: 'system',
            details: { projectId: 'proj-1', error: 'Database connection failed' },
          }),
        });
      });
    });

    describe('audit.security', () => {
      it('should create audit log with security category', async () => {
        mockDb.auditLog.create.mockResolvedValue({} as never);

        await audit.security('user-1', 'LOGIN_FAILED', { attempts: 3, ip: '192.168.1.1' });

        expect(mockDb.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'LOGIN_FAILED',
            resource: 'Security',
            severity: 'WARNING',
            category: 'security',
            details: { attempts: 3, ip: '192.168.1.1' },
          }),
        });
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should fetch audit logs with default pagination', async () => {
      const mockLogs = [
        { id: '1', action: 'CREATE', resource: 'Project', createdAt: new Date() },
        { id: '2', action: 'UPDATE', resource: 'Project', createdAt: new Date() },
      ];

      mockDb.auditLog.findMany.mockResolvedValue(mockLogs as never);
      mockDb.auditLog.count.mockResolvedValue(2 as never);

      const result = await getAuditLogs({});

      expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
          orderBy: { createdAt: 'desc' },
        })
      );
      expect(result).toEqual({
        logs: mockLogs,
        total: 2,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      });
    });

    it('should apply filters correctly', async () => {
      mockDb.auditLog.findMany.mockResolvedValue([] as never);
      mockDb.auditLog.count.mockResolvedValue(0 as never);

      await getAuditLogs({
        userId: 'user-1',
        resource: 'Project',
        action: 'CREATE',
        severity: 'INFO',
        category: 'data_access',
      });

      expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            resource: 'Project',
            action: 'CREATE',
            severity: 'INFO',
            category: 'data_access',
          }),
        })
      );
    });

    it('should apply date range filters', async () => {
      mockDb.auditLog.findMany.mockResolvedValue([] as never);
      mockDb.auditLog.count.mockResolvedValue(0 as never);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await getAuditLogs({ startDate, endDate });

      expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it('should handle custom pagination', async () => {
      mockDb.auditLog.findMany.mockResolvedValue([] as never);
      mockDb.auditLog.count.mockResolvedValue(100 as never);

      const result = await getAuditLogs({ page: 3, pageSize: 20 });

      expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40, // (3-1) * 20
          take: 20,
        })
      );
      expect(result.totalPages).toBe(5); // 100 / 20
    });
  });

  describe('exportAuditLogs', () => {
    const mockLogs = [
      {
        id: 'log-1',
        createdAt: new Date('2024-06-15T10:30:00Z'),
        action: 'CREATE',
        resource: 'Project',
        resourceId: 'proj-1',
        severity: 'INFO',
        category: 'data_access',
        ipAddress: '127.0.0.1',
        user: { email: 'test@example.com', name: 'Test User' },
      },
    ];

    it('should export logs as JSON by default', async () => {
      mockDb.auditLog.findMany.mockResolvedValue(mockLogs as never);

      const result = await exportAuditLogs({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(result).toBe(JSON.stringify(mockLogs, null, 2));
    });

    it('should export logs as CSV when format is csv', async () => {
      mockDb.auditLog.findMany.mockResolvedValue(mockLogs as never);

      const result = await exportAuditLogs({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        format: 'csv',
      });

      expect(result).toContain('ID,Timestamp,User Email,Action,Resource');
      expect(result).toContain('log-1');
      expect(result).toContain('test@example.com');
      expect(result).toContain('CREATE');
      expect(result).toContain('Project');
    });

    it('should filter logs by date range', async () => {
      mockDb.auditLog.findMany.mockResolvedValue([] as never);

      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');

      await exportAuditLogs({ startDate, endDate });

      expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: { createdAt: 'asc' },
        })
      );
    });
  });
});
