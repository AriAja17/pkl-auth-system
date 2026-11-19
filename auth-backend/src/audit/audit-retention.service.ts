import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_RETENTION_DAYS = 365;
const BATCH_SIZE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);
  private readonly retentionDays: number;

  constructor(private readonly prisma: PrismaService) {
    const raw = process.env.AUDIT_RETENTION_DAYS;
    const configured = raw === undefined || raw === '' ? DEFAULT_RETENTION_DAYS : Number(raw);
    if (!Number.isInteger(configured) || configured <= 0) {
      throw new Error(
        `AUDIT_RETENTION_DAYS harus integer positif (diterima: ${raw ?? '(tidak diatur)'})`,
      );
    }
    this.retentionDays = configured;
  }

  /** Daily at 02:00 Asia/Jakarta. waitForCompletion only guards this process. */
  @Cron('0 0 2 * *', { timeZone: 'Asia/Jakarta', waitForCompletion: true })
  async cleanupExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - this.retentionDays * DAY_MS);
    let deleted = 0;
    try {
      for (;;) {
        // IDs are re-read every batch: deleting by ID is idempotent, so a
        // concurrent instance removing the same rows cannot corrupt data.
        const rows = await this.prisma.auditLog.findMany({
          where: { createdAt: { lt: cutoff } },
          select: { id: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: BATCH_SIZE,
        });
        if (rows.length === 0) break;

        const result = await this.prisma.auditLog.deleteMany({
          where: { id: { in: rows.map((row) => row.id) } },
        });
        deleted += result.count;
        if (result.count === 0) {
          // No progress (e.g. another instance already removed the batch or
          // deletes are silently ignored): stop instead of spinning forever.
          this.logger.warn('Audit log cleanup berhenti: batch tidak menghapus baris');
          break;
        }
      }
      this.logger.log(
        `Audit log cleanup selesai: ${deleted} record dihapus ` +
          `(cutoff ${cutoff.toISOString()}, retention ${this.retentionDays} hari)`,
      );
    } catch (error) {
      this.logger.error(
        `Audit log cleanup gagal: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
