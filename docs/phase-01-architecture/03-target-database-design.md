# Phase 01 — Target Database Design (final revision)

## 1. Prinsip desain

1. **Additive dulu, destruktif kemudian.** Tidak ada kolom lama dihapus sebelum backfill terverifikasi.
2. **Kompatibilitas data.** Nama kolom existing (`password`, `permissionsId`, `roleId`) dipertahankan lewat `@map`.
3. **Permission = metadata.** Tidak ada relasi `Permission` ↔ endpoint di database.
4. **Satu otoritas:** `AuthorizationService` (dokumen 05).
5. **Tanpa hierarki role.** Scope admin via `AdminCapability`, bukan `Role.parentId`.
6. **Format key baru `action:resource`** dengan mapping eksplisit dari key lama (D1).

## 2. ERD target

```mermaid
erDiagram
    USER ||--o{ USER_ROLE : "has"
    ROLE ||--o{ USER_ROLE : "assigned to"
    ROLE ||--o{ ROLE_PERMISSION : "contains"
    PERMISSION ||--o{ ROLE_PERMISSION : "granted through"
    MENU ||--o{ MENU_PERMISSION : "requires"
    PERMISSION ||--o{ MENU_PERMISSION : "controls"
    MENU ||--o| MENU : "parent of"
    USER ||--o{ ADMIN_CAPABILITY : "grants (grantor)"
    USER ||--o{ ADMIN_CAPABILITY : "receives (grantee)"
    PERMISSION ||--o{ ADMIN_CAPABILITY : "bounds"
    USER ||--o{ AUDIT_LOG : "performs"
    ROLE ||--o{ USER : "legacy roleId (deprecated)"
    ADMIN_CAPABILITY ||--o{ ADMIN_CAPABILITY : "parent of"

    USER {
        string id PK
        string email UK
        string username UK "wajib, case-insensitive, maks 30"
        string password "nama dipertahankan, min 6"
        string name_nullable
        string phone_nullable
        boolean isActive
        datetime createdAt
        datetime updatedAt
        string legacyRoleId FK "maps to DB column roleId"
    }
    ROLE {
        string id PK
        string name UK "superadmin = sistem"
        string description_nullable
        boolean isSystem
        datetime createdAt
        datetime updatedAt
    }
    PERMISSION {
        string id PK
        string key UK "action:resource, contoh view:menu"
        string description_nullable
        boolean isProtected
        datetime createdAt
    }
    USER_ROLE {
        string userId PK_FK
        string roleId PK_FK
        string assignedBy_nullable
        datetime assignedAt
    }
    ROLE_PERMISSION {
        string roleId PK_FK
        string permissionsId PK_FK "nama lama dipertahankan"
    }
    MENU {
        string id PK
        string name
        string url_nullable
        string icon_nullable "PrimeIcons class"
        string parentId FK_nullable
        int order
        string description_nullable
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    MENU_PERMISSION {
        string menuId PK_FK
        string permissionId PK_FK
    }
    ADMIN_CAPABILITY {
        string id PK
        string userId FK "grantee"
        string permissionId FK
        string grantedBy FK "grantor"
        string parentCapabilityId FK_nullable "lineage: null = root"
        datetime grantedAt
        datetime expiresAt "wajib, TTL maks 90 hari"
    }
    AUDIT_LOG {
        string id PK
        string actorId FK_nullable
        string actorEmail "snapshot"
        string action
        string resourceType
        string resourceId_nullable
        json before_nullable "sudah diredaksi"
        json after_nullable "sudah diredaksi"
        string summary_nullable
        string ip_nullable
        string userAgent_nullable "maks 512 char"
        datetime createdAt
    }
    ARTICLE {
        string id PK "tidak berubah"
        string title
        string content
        datetime createdAt
        datetime updatedAt
    }
```

## 3. Penjelasan entity

| Entity | Tujuan | Catatan |
|---|---|---|
| `User` | Identitas + kredensial | `username` wajib unik case-insensitive, maks. 30; `password` tetap bernama demikian, min 6; `name`/`phone` nullable. |
| `Role` | Kumpulan permission | `isSystem = true` hanya `superadmin`; tiga ranah proteksi di §5. |
| `Permission` | Metadata otorisasi | Key **`action:resource`** (`view:menu`, `read:article`, `manage:user`). `isProtected` untuk permission privileged. |
| `UserRole` | Multi-role assignment | Composite PK; `assignedBy` jejak admin. |
| `RolePermission` | Role ↔ permission | Kolom `permissionsId` dipertahankan. |
| `Menu` | Navigasi dinamis | `parentId` self-relation; `url` nullable untuk group; `order` urutan sibling. |
| `MenuPermission` | Menu ↔ permission | Many-to-many. Default **ANY-of** (O1). |
| `AdminCapability` | Batas delegasi | `grantedBy` + `parentCapabilityId` membentuk **lineage** source-grant; `expiresAt` wajib ≤ 90 hari; 13 aturan di dokumen 05 §7.2, penelusuran & invalidasi di §7.3. |
| `AuditLog` | Jejak administratif | `actorEmail` snapshot; `before/after` sudah diredaksi; retention 365 hari. |
| `Article` | Fitur existing | Tidak diubah. |

## 4. Constraint & index

| Lokasi | Constraint / index | Alasan |
|---|---|---|
| `User.email` | `@unique` | Existing. |
| `User.username` | `@unique` + `citext`, `[a-z0-9_]{3,30}` | D4; migration `CREATE EXTENSION IF NOT EXISTS citext;`. |
| `User.legacyRoleId` | FK → `Role.id`, `onDelete: Restrict`, `@map("roleId")` | Kompatibilitas. |
| `UserRole` | `@@id([userId, roleId])`, `@@index([roleId])` | Idempotent + query balik. |
| `RolePermission` | `@@id([roleId, permissionsId])` | Existing. |
| `Permission.key` | `@unique`, regex `^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$` | Format `action:resource` (D1). |
| `Menu.parentId` | FK self, `onDelete: SetNull`, `@@index([parentId])` | Hapus parent → anak jadi root. |
| `MenuPermission` | `@@id([menuId, permissionId])` | Idempotent. |
| `AdminCapability` | `@@unique([userId, permissionId])`, `@@index([grantedBy])`, `@@index([parentCapabilityId])` | Satu capability per pasangan + query rantai + penelusuran lineage. Self-FK `parentCapabilityId` `onDelete: Cascade` → cabut/expired ancestor menghapus descendant. |
| `AuditLog` | `@@index([actorId, createdAt])`, `@@index([resourceType, resourceId])`, `@@index([createdAt])` | Filter + cleanup retensi. |

Aturan aplikasi:
- Role `isSystem = true` tidak bisa dikonfigurasi/diassign/diubah permission-nya via API (§5).
- `isProtected` hanya di role sistem, kecuali `superadmin` dan aturan delegasi terpenuhi.
- `Menu.url` diawali `/`, bukan `javascript:`; `icon` pola PrimeIcons; **siklus `Menu.parentId` dilarang keras** dan divalidasi sebagai graph saat create/update (dokumen 05 §6, 06 §6, 07 §7).
- Backfill username deterministik (dokumen 07 M2 langkah 1).

## 5. Proteksi `superadmin` — tiga ranah

| Ranah | Operasi | Aturan |
|---|---|---|
| **Konfigurasi role** | rename, ubah `description`, ubah `isSystem`, hapus role | **Ditolak**. Flag `isSystem` hanya seed/migrasi. |
| **Assignment user-role** | beri/cabut role `superadmin`; ubah/hapus akun pemegangnya | **Ditolak** via API. Role hanya melekat pada akun seed. |
| **Manajemen permission** | `PUT /admin/roles/:id/permissions` pada role sistem | **Ditolak**. Mencegah pencabutan `grant:admin`, `manage:user`, dll. |

Invariant: minimal satu user `superadmin` selalu ada; permission baru otomatis masuk role itu lewat seed **atau**, untuk permission yang dibuat via `POST /admin/permissions`, lewat penugasan transaksional dalam request yang sama (dokumen 05 §5 & 06 §5). Prosedur bootstrap & recovery ada di dokumen 05 §7.1.

## 6. Pemetaan data lama → target

| Data existing | Perlakuan | Verifikasi |
|---|---|---|
| `User.roleId` | Dibuat `UserRole`; kolom lama jadi `legacyRoleId` (`@map("roleId")`) | Jumlah `UserRole` = user ber-`roleId` lama |
| Role `Admin` | Di-update jadi `superadmin`, `isSystem = true` | Role existing terbaca |
| `article.read` | → `read:article` | Endpoint Article tetap lolos |
| `article.create` | → `create:article` |Sama |
| `article.update` | → `update:article` |Sama |
| `article.delete` | → `delete:article` |Sama |
| `user.manage` | → `manage:user`, `isProtected = true` | Guard admin tetap lolos |
| `RolePermission` | Tidak berubah (FK pakai `Permission.id`) | Jumlah baris identik |
| User tanpa role | Tetap tanpa `UserRole` | Dashboard tanpa akses admin |
| `Article` + migrasinya | Tidak berubah | Data & endpoint artikel ada |
| User tanpa `username` | Backfill deterministik | Unik case-insensitive, ≤ 30 char |

Catatan: seluruh mapping dilakukan dengan `UPDATE "Permission" SET key = ...` **per key**, bukan wildcard. Karena FK memakai `id`, tidak ada assignment yang terputus.

## 7. Open items

- **O1** — Menu multi-permission: default **ANY-of**; konfirmasi jika mentor mau ALL-of.
- **O2** — Kolom `roleId`: dihapus di M3 atau disimpan sebagai arsip.
- **O3** — Token `localStorage` → `httpOnly`: Phase 02 atau lanjutan.
- **O4** — Daftar ~196 permission ERP mentor belum tersedia; tidak di-seed otomatis.
