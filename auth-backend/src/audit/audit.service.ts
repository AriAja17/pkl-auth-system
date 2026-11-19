import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from '../authorization/principal';
import { redactAuditPayload } from './audit-redaction';

export type AuditInput = {
  actorId?: string | null;
  actorEmail: string;
  /** Format: resource.action (e.g. role.permissions.update), NOT a permission key. */
  action: string;
  resourceType: string;
  resourceId?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

export type AuditListQuery = {
  page?: number;
  limit?: number;
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
};

type AuditWriter = { auditLog: PrismaService['auditLog'] };

export function auditActor(
  principal: Principal,
  ip?: string | null,
  userAgent?: string | null,
) {
  return {
    actorId: principal.id,
    actorEmail: principal.email,
    ip: ip ?? null,
    userAgent: userAgent ?? null,
  };
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** Called with the same transaction client as the corresponding mutation. */
  async record(input: AuditInput, client: AuditWriter = this.prisma): Promise<void> {
    const before = redactAuditPayload(input.before, input.resourceType);
    const after = redactAuditPayload(input.after, input.resourceType);

    await client.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        summary: input.summary ?? null,
        before: before === null ? Prisma.JsonNull : (before as Prisma.InputJsonValue),
        after: after === null ? Prisma.JsonNull : (after as Prisma.InputJsonValue),
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
      },
    });
  }

  async list(query: AuditListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
