# Phase 02 — Preflight Permission Baseline

> Catatan: ini baseline read-only pada 2026-11-18, bukan kondisi database saat ini. Lihat README dan dokumen 07 untuk status implementasi terkini.

**Captured:** 2026-11-18T13:28:25+07:00
**Scope:** read-only preflight (M0). No migration, seed, generate, or database write was performed.
**Source:** local working tree + read-only queries against the configured Supabase PostgreSQL database.

## 1. Database migration status at preflight

| Item | Value |
|---|---|
| Prisma config loaded | `prisma7.config.ts` (auto-detected by CLI 7.10.1) |
| Schema validation | `npx prisma validate` → valid |
| Migration status | `npx prisma migrate status` → **Database schema is up to date** |
| Applied migrations | `20261112022214_init` (finished), `20261117070522_add_article` (finished) |
| Migrations found locally | 2 |
| Drift | None reported |

## 2. Anonymized user baseline

Identifiers are stable, salt-free SHA-256 prefixes of the account email, truncated to 12 uppercase hex characters. They are reproducible from the database at verification time **without storing emails**. No personal data, credentials, tokens, or connection strings appear in this document.

| Stable ID | Legacy `roleId` present | Original permission keys (verbatim, `resource.action`) | Key count |
|---|---|---|---|
| `PF-94675024B8D8` | yes | `article.create`, `article.delete`, `article.read`, `article.update`, `user.manage` | 5 |
| `PF-9C3F904528E5` | no | *(none)* | 0 |
| `PF-3D0A2A224526` | yes | `article.read`, `article.update` | 2 |

## 3. Counts

| Metric | Count |
|---|---|
| Total users | **3** |
| Users with legacy `roleId` | **2** |
| Users without role | **1** |
| Permission rows in database | **5** |
| Article rows | **1** |

Legacy permission keys present: `article.create`, `article.delete`, `article.read`, `article.update`, `user.manage`.

## 4. Expected verification conditions after M1/M2

Permission keys are normalized with the approved explicit mapping:

| Legacy key | Canonical key (`action:resource`) |
|---|---|
| `article.read` | `read:article` |
| `article.create` | `create:article` |
| `article.update` | `update:article` |
| `article.delete` | `delete:article` |
| `user.manage` | `manage:user` |

Checks that must pass before Phase 02 is accepted:

1. **No key collision** occurred; migration would have aborted if a target key already existed. Preflight result: 0 collisions.
2. For `PF-9C3F904528E5`: effective permissions remain **empty**; no `UserRole` row is created.
3. For `PF-3D0A2A224526`: effective permissions are exactly `read:article` and `update:article` — no additions, no losses.
4. For `PF-94675024B8D8`: the role `Admin` is renamed to `superadmin` with `isSystem = true`. The 5 mapped keys remain assigned; this account **intentionally gains** the newly seeded permissions (including `grant:admin`) because all permissions are granted to the system role. This is the only permitted permission-set change.
5. `SELECT count(*) FROM "UserRole"` = **2** equals users that had a legacy `roleId` before migration.
6. `SELECT count(*) FROM "Permission" WHERE key LIKE '%.%'` = **0**; all keys use `action:resource`.
7. Expected total permission rows after seeding: **26** (5 mapped keys + 21 newly seeded canonical keys), subject to the exact seed list in `04-prisma-schema-proposal.prisma` / doc 07 §M2.6.
8. `SELECT count(*) FROM "Article"` remains **1**; `GET/POST/PUT/DELETE /articles` work with `read:article`, `create:article`, `update:article`, `delete:article`.
9. `User.username` is non-null for all 3 users, case-insensitively unique, ≤ 30 characters, matching `^[a-z0-9_]{3,30}$`.
10. `User.updatedAt` and `Role.updatedAt` are non-null (`NOT NULL`) for all pre-existing rows.
11. Legacy `User.roleId` column still exists and retains its pre-migration values throughout Phase 02 (M3 cleanup is deferred and requires separate approval).

## 5. Notes

- This baseline is a snapshot of authorization metadata only. It contains no passwords, tokens, emails, or connection details.
- If any of the conditions above fail after M1/M2, stop and follow the rollback procedure in the approved Phase 02 plan (§10) before proceeding.
