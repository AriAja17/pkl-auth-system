# Phase 01 — API Contract (final revision)

## 1. Konvensi umum

- Base URL: `http://localhost:4000`.
- Header: `Authorization: Bearer <accessToken>`.
- Format permission key: **`action:resource`** — `^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$`. Contoh: `view:menu`, `create:user`, `read:article`, `manage:user`.
- Username: `[a-z0-9_]{3,30}`, unik **case-insensitive**, disimpan huruf kecil.
- Password: **minimal 6 karakter** (D5, sesuai form mentor).
- Error envelope Nest default: `{ "statusCode": 403, "message": "...", "error": "Forbidden" }`.
- Pagination: `{ "items": [...], "total": 196, "page": 1, "limit": 10 }`.
- Validasi global yang disepakati: **`ValidationPipe({ whitelist: true, transform: true })`** di Phase 02. `forbidNonWhitelisted` **tidak** diaktifkan, sehingga field asing tetap dibuang (perilaku existing). Konfigurasi identik di dokumen 02 dan 07.
- `roleIds` / `permissionKeys` / `permissionIds` harus ada; yang tidak dikenal → `400`.

## 2. Authentication

| Method | Path | Akses | Body / Query | Respons |
|---|---|---|---|---|
| POST | `/auth/register` | Publik | `{ email, password (min 6), username? }` | `{ id, email, username }` |
| POST | `/auth/login` | Publik | `{ email, password }` | `{ accessToken }` |
| GET | `/auth/me` | Token | — | `{ id, email, username, name, phone, roles[], permissions[], menus[] }` |

`username` kosong → generate deterministik dari email (dokumen 07 M2 langkah 1). JWT payload tetap `{ sub }`.

```json
{
  "id": "uuid",
  "email": "superadmin@example.com",
  "username": "superadmin",
  "name": "Super Admin",
  "phone": null,
  "roles": [{ "id": "uuid", "name": "superadmin", "isSystem": true }],
  "permissions": ["manage:user", "read:article", "view:menu"],
  "menus": [
    {
      "id": "uuid", "name": "User Management", "url": null,
      "icon": "pi-list-fw pi-users", "parentId": null, "order": 1,
      "children": [
        { "id": "uuid", "name": "Menu", "url": "/menus", "icon": "pi-list-fw pi-bars",
          "parentId": "uuid", "order": 1, "children": [] }
      ]
    }
  ]
}
```

## 3. User management

| Method | Path | Permission | Body / Query |
|---|---|---|---|
| GET | `/admin/users` | `read:user` | `?page=1&limit=10&search=` |
| POST | `/admin/users` | `create:user` | `{ name, username, email, phone?, password, roleIds[] }` |
| GET | `/admin/users/:id` | `read:user` | — |
| PATCH | `/admin/users/:id` | `update:user` | `{ name?, phone?, isActive? }` |
| DELETE | `/admin/users/:id` | `delete:user` | — |
| PUT | `/admin/users/:id/roles` | `update:user` | `{ roleIds[] }` |
| POST | `/admin/users/:id/roles/:roleId` | `update:user` | — |
| DELETE | `/admin/users/:id/roles/:roleId` | `update:user` | — |
| PUT | `/admin/users/:id/role` | `manage:user` | **Deprecated alias** single-role |

Aturan: tidak boleh mengubah/hapus diri sendiri; tidak boleh memberi/mengubah `superadmin`; username unik case-insensitive.

## 4. Role management

| Method | Path | Permission | Body / Query |
|---|---|---|---|
| GET | `/admin/roles` | `read:role` | `?page&limit&search` |
| POST | `/admin/roles` | `create:role` | `{ name, description?, permissionKeys[] }` |
| GET | `/admin/roles/:id` | `read:role` | — |
| PATCH | `/admin/roles/:id` | `update:role` | `{ name?, description? }` |
| DELETE | `/admin/roles/:id` | `delete:role` | — |
| PUT | `/admin/roles/:id/permissions` | `update:role` | `{ permissionKeys[] }` — path existing dipertahankan |

Respons: `{ id, name, description, permissions: string[], usersCount, createdAt }`. `PATCH`, `DELETE`, dan `PUT .../permissions` pada `superadmin` → `403` (dokumen 05 §7.1).

`POST /admin/roles`: untuk actor non-`superadmin`, **setiap** `permissionKeys[]` divalidasi ⊆ capability actor dan ⊆ permission actor — pemeriksaan subset dilakukan **saat create**, tidak hanya saat set permission kemudian (dokumen 05 §7.2 aturan 5).

## 5. Permission management

| Method | Path | Permission | Body / Query |
|---|---|---|---|
| GET | `/admin/permissions` | `read:permission` | `?page&limit&search`; menyertakan `roles[]` |
| POST | `/admin/permissions` | `create:permission` | `{ key, description? }` — key `action:resource`; **transaksional: permission otomatis ditambahkan ke role `superadmin`** |
| GET | `/admin/permissions/:id` | `read:permission` | — |
| PATCH | `/admin/permissions/:id` | `update:permission` | `{ description? }` |
| DELETE | `/admin/permissions/:id` | `delete:permission` | `409` jika masih dipakai |
| GET | `/admin/permissions/drift` | `read:permission` | — |

```json
{ "orphan": ["legacy:unused"], "unregistered": ["GET /admin/menus"] }
```

Hanya melapor; tidak membuat endpoint/permission. **Setiap endpoint terproteksi wajib ada di policy registry**; temuan `unregistered` harus dibereskan sebelum deploy (dokumen 05 §8).

Aturan permission terhadap role sistem:
- `POST /admin/permissions` → buat `Permission` **dan** `RolePermission` untuk `superadmin` dalam **satu transaksi**; gagal di tengah → rollback keduanya.
- `PATCH` / `DELETE /admin/permissions/:id` **tidak boleh** menghapus atau mengubah permission yang melekat pada `superadmin` (khususnya `isProtected`). `DELETE` ditolak (`409`) jika masih dipakai role/menu, termasuk role sistem.
- Satu-satunya jalur API yang menambah permission ke role sistem adalah `POST /admin/permissions` di atas; `PUT /admin/roles/:id/permissions` pada `superadmin` tetap `403`.

## 6. Menu management

| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/menus` | `read:menu` | `?page&limit`; tree |
| POST | `/admin/menus` | `create:menu` | `{ name, url?, icon?, parentId?, permissionIds[], order?, description?, isActive? }` |
| GET | `/admin/menus/:id` | `read:menu` | — |
| PATCH | `/admin/menus/:id` | `update:menu` | field sama |
| DELETE | `/admin/menus/:id` | `delete:menu` | anak jadi root |
| PUT | `/admin/menus/:id/permissions` | `update:menu` | `{ permissionIds[] }` |

Validasi: `url` diawali `/`; `icon` pola PrimeIcons; **siklus `Menu.parentId` dilarang keras** — service memvalidasi graph saat create/update dan menolak (`400`) jika terbentuk siklus langsung maupun transitif.

## 7. Delegated administration

| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/delegations` | `read:delegation` | `?granteeId` |
| POST | `/admin/delegations` | `create:delegation` | `{ granteeId, permissionKeys[], expiresAt }` |
| DELETE | `/admin/delegations/:id` | `delete:delegation` | UUID `AdminCapability` |

`expiresAt` wajib, masa depan, ≤ 90 hari. 13 aturan di dokumen 05 §7.2 **dan mekanisme lineage di §7.3** berlaku.

`parentCapabilityId` **ditentukan server**, bukan input klien: saat create, capability baru menunjuk ke capability actor yang dipakai sebagai sumber (root = `null` hanya untuk grant langsung `superadmin`). Respons: `{ id, grantee, permissionKey, grantor, parentCapabilityId, grantedAt, expiresAt }`. Mencabut ancestor (`DELETE`) atau expired → descendant ikut invalid/hapus (cascade + pengecekan rantai).

## 8. Audit log

| Method | Path | Permission | Query |
|---|---|---|---|
| GET | `/admin/audit-logs` | `read:audit` | `?actorId&action&resourceType&resourceId&from&to&page&limit` |

Field `before/after` sudah diredaksi; retention default 365 hari. **`AuditLog.action` memakai `resource.action`** (mis. `user.create`, `role.permissions.update`) dan **bukan** permission key `action:resource` (mis. `create:user`). Keduanya berbeda dan tidak boleh disamakan.

## 9. Articles (endpoint existing, key diubah)

| Method | Path | Permission lama | Permission baru |
|---|---|---|---|
| GET | `/articles` | `article.read` | `read:article` |
| POST | `/articles` | `article.create` | `create:article` |
| PUT | `/articles/:id` | `article.update` | `update:article` |
| DELETE | `/articles/:id` | `article.delete` | `delete:article` |

Perilaku endpoint identik; hanya deklarasi guard yang ikut migrasi key.

## 10. Status code

| Kode | Kasus |
|---|---|
| 200 / 201 | Sukses |
| 400 | Body invalid, key/ID tidak dikenal, format key salah, siklus menu, `expiresAt` > 90 hari |
| 401 | Token tidak ada/valid/kedaluwarsa, user nonaktif |
| 403 | Permission kurang, delegasi/eskalasi dilanggar, aksi ke diri sendiri, role sistem disentuh |
| 404 | Tidak ditemukan |
| 409 | Email/username/role duplikat; role/permission masih dipakai |

## 11. Konsistensi

Nama tabel/field mengikuti `04-prisma-schema-proposal.prisma`; permission key `action:resource` mengikuti D1; mapping key lama → baru dan verifikasinya ada di dokumen 07. Tidak ada endpoint yang dibuat otomatis dari baris `Permission`.
