import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from './audit.service';
import { redactAuditPayload } from './audit-redaction';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from '../authorization/principal';
import { AuthorizationService } from '../authorization/authorization.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

const principal = (permissions: string[]): Principal => ({
  id: 'actor-1',
  email: 'admin@example.com',
  username: 'admin',
  isActive: true,
  roles: [],
  permissions: new Set(permissions),
  capabilities: new Set(),
  isSystem: false,
  legacyRoleName: null,
  legacyPermissions: [],
});

describe('AuditService', () => {
  let prisma: any;
  let service: AuditService;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (arg: any) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
      ),
    };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('whitelists fields, masks email/phone and drops secrets', () => {
    const result: any = redactAuditPayload(
      {
        id: 'u1',
        email: 'user@example.com',
        phone: '1234567890',
        password: 'secret',
        accessToken: 'jwt',
        isActive: true,
        unknownField: 'drop-me',
      },
      'user',
    );
    expect(result.email).toBe('u***@example.com');
    expect(result.phone).toBe('******7890');
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('unknownField');
    expect(result.isActive).toBe(true);
  });

  it('writes the audit row through the supplied transaction client', async () => {
    const tx = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    await service.record(
      {
        actorId: 'actor-1',
        actorEmail: 'admin@example.com',
        action: 'user.update',
        resourceType: 'user',
        resourceId: 'u1',
        before: { email: 'user@example.com', password: 'secret' },
        after: { email: 'other@example.com' },
      },
      tx as never,
    );
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const data = tx.auditLog.create.mock.calls[0][0].data;
    expect(data.action).toBe('user.update');
    expect(JSON.stringify(data.before)).not.toContain('secret');
    expect(JSON.stringify(data.before)).toContain('***@example.com');
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('supports pagination and filters on audit listing', async () => {
    await service.list({
      page: 2,
      limit: 5,
      actorId: 'actor-1',
      action: 'user.create',
      resourceType: 'user',
      from: '2026-01-01T00:00:00.000Z',
    });
    const args = prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.skip).toBe(5);
    expect(args.where.actorId).toBe('actor-1');
    expect(args.where.action).toBe('user.create');
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it('requires read:audit for the audit endpoint', () => {
    const authorization = new AuthorizationService({
      user: { findUnique: jest.fn() },
      adminCapability: { findMany: jest.fn() },
    } as unknown as PrismaService);
    const guard = new PermissionsGuard(new Reflector(), authorization);
    class Handler {
      @RequirePermissions('read:audit')
      list() {}
    }
    const context = {
      getHandler: () => Handler.prototype.list,
      getClass: () => Handler,
      switchToHttp: () => ({ getRequest: () => ({ user: principal(['read:user']) }) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(
      guard.canActivate({
        ...context,
        switchToHttp: () => ({ getRequest: () => ({ user: principal(['read:audit']) }) }),
      } as unknown as ExecutionContext),
    ).toBe(true);
  });
});
