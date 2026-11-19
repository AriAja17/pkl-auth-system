import { Logger } from '@nestjs/common';
import { AuditRetentionService } from './audit-retention.service';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('AuditRetentionService', () => {
  const originalRetention = process.env.AUDIT_RETENTION_DAYS;
  let prisma: any;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let auditSpy: jest.SpyInstance;

  beforeEach(() => {
    delete process.env.AUDIT_RETENTION_DAYS;
    prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    auditSpy = jest.spyOn(AuditService.prototype, 'record').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalRetention === undefined) delete process.env.AUDIT_RETENTION_DAYS;
    else process.env.AUDIT_RETENTION_DAYS = originalRetention;
  });

  const service = () => new AuditRetentionService(prisma as unknown as PrismaService);
  const cutoffOf = () =>
    prisma.auditLog.findMany.mock.calls[0][0].where.createdAt.lt as Date;

  it('uses the default 365-day retention when the env var is unset', async () => {
    await service().cleanupExpired();

    expect(Math.abs(cutoffOf().getTime() - (Date.now() - 365 * DAY_MS))).toBeLessThan(5000);
  });

  it('uses a valid custom retention value', async () => {
    process.env.AUDIT_RETENTION_DAYS = '30';

    await service().cleanupExpired();

    expect(Math.abs(cutoffOf().getTime() - (Date.now() - 30 * DAY_MS))).toBeLessThan(5000);
  });

  it('rejects invalid retention configuration clearly', () => {
    for (const value of ['0', '-1', '1.5', 'abc', '365days']) {
      process.env.AUDIT_RETENTION_DAYS = value;
      expect(() => service()).toThrow(/AUDIT_RETENTION_DAYS/);
    }
  });

  it('queries only records older than the cutoff, ordered for stable batching', async () => {
    await service().cleanupExpired();

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 1000,
    });
  });

  it('deletes in batches of at most 1000 ids and repeats until no old rows remain', async () => {
    const firstBatch = Array.from({ length: 1000 }, (_, index) => ({ id: `old-${index}` }));
    prisma.auditLog.findMany
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce([{ id: 'old-1000' }, { id: 'old-1001' }])
      .mockResolvedValueOnce([]);
    prisma.auditLog.deleteMany
      .mockResolvedValueOnce({ count: 1000 })
      .mockResolvedValueOnce({ count: 2 });

    await service().cleanupExpired();

    expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(2);
    const calls = prisma.auditLog.deleteMany.mock.calls;
    expect(calls[0][0].where.id.in).toHaveLength(1000);
    expect(calls[1][0].where.id.in).toEqual(['old-1000', 'old-1001']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1002 record dihapus'));
  });

  it('stops without deleting when there are no old records', async () => {
    await service().cleanupExpired();

    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('0 record dihapus'));
  });

  it('never deletes ids outside the expired query result', async () => {
    prisma.auditLog.findMany
      .mockResolvedValueOnce([{ id: 'expired-1' }])
      .mockResolvedValueOnce([]);

    await service().cleanupExpired();

    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['expired-1'] } },
    });
  });

  it('does not create any audit log while cleaning up', async () => {
    prisma.auditLog.findMany
      .mockResolvedValueOnce([{ id: 'expired-1' }])
      .mockResolvedValueOnce([]);

    await service().cleanupExpired();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it('logs and swallows a database read failure', async () => {
    prisma.auditLog.findMany.mockRejectedValueOnce(new Error('db down'));

    await expect(service().cleanupExpired()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('db down'),
      expect.any(String),
    );
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('selesai'));
  });

  it('logs and swallows a database delete failure', async () => {
    prisma.auditLog.findMany
      .mockResolvedValueOnce([{ id: 'expired-1' }])
      .mockResolvedValueOnce([]);
    prisma.auditLog.deleteMany.mockRejectedValueOnce(new Error('delete failed'));

    await expect(service().cleanupExpired()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('delete failed'),
      expect.any(String),
    );
  });

  it('logs concurrent batches that delete nothing instead of looping forever', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'raced-1' }]);
    prisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    await service().cleanupExpired();

    expect(warnSpy).toHaveBeenCalled();
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(1);
  });
});
