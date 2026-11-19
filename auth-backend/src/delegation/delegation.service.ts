import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from '../authorization/principal';
import { AuditService, auditActor } from '../audit/audit.service';
import { CreateDelegationDto } from '../admin/dto/create-delegation.dto';
import { ListDelegationsQueryDto } from '../admin/dto/list-delegations.dto';

const MAX_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type CapabilityRow = {
  id: string;
  userId: string;
  grantedBy: string;
  permissionId: string;
  parentCapabilityId: string | null;
  expiresAt: Date;
  grantedAt: Date;
  permission: { key: string };
};

@Injectable()
export class DelegationService {
  constructor(
    private prisma: PrismaService,
    @Optional() private audit?: AuditService,
  ) {}

  private async allCapabilities(): Promise<CapabilityRow[]> {
    return (await this.prisma.adminCapability.findMany({
      include: { permission: true },
    })) as unknown as CapabilityRow[];
  }

  private lineageValid(
    id: string,
    byId: Map<string, CapabilityRow>,
    now: Date,
  ): boolean {
    const seen = new Set<string>();
    let current = byId.get(id);
    while (current) {
      if (seen.has(current.id)) return false;
      seen.add(current.id);
      if (current.expiresAt <= now) return false;
      if (!current.parentCapabilityId) return true;
      const parent = byId.get(current.parentCapabilityId);
      if (!parent) return false; // dangling ancestor -> fail closed
      // One row = one permission: a descendant must keep its parent's permission.
      if (current.permissionId !== parent.permissionId) return false;
      current = parent;
    }
    return false;
  }

  private descendantsOf(id: string, all: CapabilityRow[]): string[] {
    const children = new Map<string, string[]>();
    for (const capability of all) {
      if (!capability.parentCapabilityId) continue;
      const list = children.get(capability.parentCapabilityId) ?? [];
      list.push(capability.id);
      children.set(capability.parentCapabilityId, list);
    }
    const result: string[] = [];
    const queue = [...(children.get(id) ?? [])];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (seen.has(current)) continue;
      seen.add(current);
      result.push(current);
      queue.push(...(children.get(current) ?? []));
    }
    return result;
  }

  async list(query: ListDelegationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = query.granteeId ? { userId: query.granteeId } : {};
    const all = await this.allCapabilities();
    const byId = new Map(all.map((capability) => [capability.id, capability]));
    const rows = (await this.prisma.adminCapability.findMany({
      where,
      include: { permission: true },
      orderBy: { grantedAt: 'desc' },
    })) as unknown as CapabilityRow[];

    const now = new Date();
    const items = rows.map((capability) => ({
      id: capability.id,
      granteeId: capability.userId,
      permissionKey: capability.permission.key,
      grantedBy: capability.grantedBy,
      parentCapabilityId: capability.parentCapabilityId,
      grantedAt: capability.grantedAt,
      expiresAt: capability.expiresAt,
      valid: this.lineageValid(capability.id, byId, now),
    }));

    return {
      items: items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit,
    };
  }

  async create(dto: CreateDelegationDto, actor: Principal) {
    const now = new Date();
    const expiresAt = new Date(dto.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
      throw new BadRequestException('expiresAt harus di masa depan');
    }
    if (expiresAt.getTime() > now.getTime() + MAX_TTL_MS) {
      throw new BadRequestException('Maksimal masa delegasi 90 hari');
    }

    const keys = [...new Set(dto.permissionKeys)];
    if (keys.length === 0) throw new BadRequestException('permissionKeys wajib diisi');
    if (dto.granteeId === actor.id) {
      throw new ForbiddenException('Tidak boleh mendelegasikan ke diri sendiri');
    }

    const permissions = new Map<string, string>();
    for (const key of keys) {
      if (key === 'grant:admin') {
        throw new ForbiddenException('grant:admin tidak bisa didelegasikan');
      }
      if (key === 'create:delegation' && !actor.isSystem) {
        throw new ForbiddenException('create:delegation hanya untuk superadmin');
      }
      const permission = await this.prisma.permission.findUnique({ where: { key } });
      if (!permission) throw new BadRequestException(`Permission tidak dikenal: ${key}`);
      if (permission.isProtected && !actor.isSystem) {
        throw new ForbiddenException(`Permission ${key} hanya untuk superadmin`);
      }
      if (!actor.isSystem && !actor.permissions.has(key)) {
        throw new ForbiddenException(`Actor tidak memiliki permission ${key}`);
      }
      if (!actor.isSystem && !actor.capabilities.has(key)) {
        throw new ForbiddenException(`Actor tidak memiliki capability ${key}`);
      }
      permissions.set(key, permission.id);
    }

    const all = await this.allCapabilities();
    const byId = new Map(all.map((capability) => [capability.id, capability]));
    const actorCapabilities = all.filter(
      (capability) => capability.userId === actor.id && this.lineageValid(capability.id, byId, now),
    );

    const plans: { permissionId: string; key: string; parentCapabilityId: string | null }[] = [];
    for (const key of keys) {
      const source = actorCapabilities.find((capability) => capability.permission.key === key);
      let parentCapabilityId: string | null = null;

      if (key === 'create:delegation') {
        // One level only: always a root granted directly by superadmin.
        parentCapabilityId = null;
      } else if (!actor.isSystem) {
        if (!source) {
          throw new ForbiddenException(`Capability sumber untuk ${key} tidak ditemukan/expired`);
        }
        parentCapabilityId = source.id;
      } else {
        parentCapabilityId = source?.id ?? null;
      }

      if (parentCapabilityId) {
        let current = byId.get(parentCapabilityId);
        const seen = new Set<string>();
        while (current) {
          if (seen.has(current.id)) break;
          seen.add(current.id);
          if (current.userId === dto.granteeId) {
            throw new ForbiddenException('Grantee adalah ancestor dari grantor (siklus)');
          }
          current = current.parentCapabilityId ? byId.get(current.parentCapabilityId) : undefined;
        }
      }

      // Duplicate resolution happens inside the transaction below so an
      // expired/invalid row can be replaced atomically instead of blocking.
      plans.push({
        permissionId: permissions.get(key) as string,
        key,
        parentCapabilityId,
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const rows: any[] = [];
      for (const plan of plans) {
        // Re-check inside the transaction: only a still-valid capability blocks
        // the grant. An expired/invalid one is replaced in the same transaction.
        const existing = await tx.adminCapability.findUnique({
          where: {
            userId_permissionId: {
              userId: dto.granteeId,
              permissionId: plan.permissionId,
            },
          },
        });
        let stale: CapabilityRow | null = null;
        let invalidatedDescendantIds: string[] = [];
        if (existing) {
          const current = (await tx.adminCapability.findMany({
            include: { permission: true },
          })) as unknown as CapabilityRow[];
          const currentById = new Map(current.map((capability) => [capability.id, capability]));
          if (this.lineageValid(existing.id, currentById, now)) {
            throw new ConflictException('Capability sudah diberikan ke grantee');
          }
          stale = existing as unknown as CapabilityRow;
          invalidatedDescendantIds = this.descendantsOf(existing.id, current);
          // ON DELETE CASCADE on parentCapabilityId removes descendants in the DB.
          await tx.adminCapability.delete({ where: { id: existing.id } });
        }

        const row = await tx.adminCapability.create({
          data: {
            userId: dto.granteeId,
            permissionId: plan.permissionId,
            grantedBy: actor.id,
            parentCapabilityId: plan.parentCapabilityId,
            expiresAt,
          },
        });
        rows.push(row);

        if (stale && this.audit) {
          await this.audit.record(
            {
              ...auditActor(actor),
              action: 'delegation.revoke',
              resourceType: 'delegation',
              resourceId: stale.id,
              before: {
                id: stale.id,
                granteeId: stale.userId,
                permissionKey: plan.key,
                grantedBy: stale.grantedBy,
                parentCapabilityId: stale.parentCapabilityId,
                expiresAt: stale.expiresAt,
              },
              after: { id: stale.id, replacedBy: row.id, invalidatedDescendantIds },
            },
            tx,
          );
        }
        if (this.audit) {
          await this.audit.record(
            {
              ...auditActor(actor),
              action: 'delegation.create',
              resourceType: 'delegation',
              resourceId: row.id,
              before: null,
              after: {
                id: row.id,
                granteeId: dto.granteeId,
                permissionKey: plan.key,
                grantedBy: actor.id,
                parentCapabilityId: plan.parentCapabilityId,
                expiresAt,
              },
            },
            tx,
          );
        }
      }
      return rows;
    });

    return created.map((row: any) => ({
      id: row.id,
      granteeId: row.userId,
      permissionKey: keys.find((key) => permissions.get(key) === row.permissionId),
      grantedBy: row.grantedBy,
      parentCapabilityId: row.parentCapabilityId,
      grantedAt: row.grantedAt,
      expiresAt: row.expiresAt,
    }));
  }

  async revoke(id: string, actor: Principal) {
    const capability = await this.prisma.adminCapability.findUnique({
      where: { id },
      include: { permission: true },
    });
    if (!capability) throw new NotFoundException('Delegasi tidak ditemukan');
    if (
      !actor.isSystem &&
      (capability.userId === actor.id || capability.grantedBy === actor.id)
    ) {
      throw new ForbiddenException('Tidak boleh mencabut capability sendiri atau grantor');
    }

    const all = await this.allCapabilities();
    const descendants = this.descendantsOf(id, all);

    await this.prisma.$transaction(async (tx) => {
      // ON DELETE CASCADE on parentCapabilityId removes descendants in the DB.
      await tx.adminCapability.delete({ where: { id } });
      if (this.audit) {
        await this.audit.record(
          {
            ...auditActor(actor),
            action: 'delegation.revoke',
            resourceType: 'delegation',
            resourceId: id,
            before: {
              id,
              granteeId: capability.userId,
              permissionKey: capability.permission.key,
              grantedBy: capability.grantedBy,
              parentCapabilityId: capability.parentCapabilityId,
              expiresAt: capability.expiresAt,
            },
            after: { id, invalidatedDescendantIds: descendants },
          },
          tx,
        );
      }
    });

    return { message: 'Delegasi dicabut', invalidatedDescendantIds: descendants };
  }
}
