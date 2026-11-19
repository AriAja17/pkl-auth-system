# Phase 01 — API Contract (final revision)

## 1. Konvensi umum

- Base URL: `http://localhost:4000`.
- Header: `Authorization: Bearer <accessToken>`.
- Format permission key: **`action:resource`** — `^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$`. Contoh: `read:menu`, `create:user`, `read:article`, `manage:user`.
- Username: `[a-z0-9_]{3,30}`, unik **case-insensitive**, disimpan huruf kecil.
- Password: **minimal 6 karakter** (D5, sesuai form mentor).
- Error envelope Nest default: `{ "statusCode": 403, "message": "...", "error": "Forbidden" }`.
- Pagination: `{ "items": [...], "total": 196, "page": 1, "limit": 10 }` untuk endpoint daftar. `GET /admin/menus` **kecuali**: mengembalikan tree utuh tanpa pagination nyata.
- Validasi global yang disepakati: **`ValidationPipe({ whitelist: true, transform: true })`** di Phase 02. `forbidNonWhitelisted` **tidak** diaktifkan, sehingga field asing tetap dibuang (perilaku existing). Konfigurasi identik di dokumen 02 dan 07.
- Field wajib/opsional mengikuti DTO aktual, bukan asumsi:

| DTO / endpoint | Wajib | Opsional |
|---|---|---|
| `POST /auth/register` | `email`, `password` | `username?` |
| `POST /admin/users` | `email`, `password` | `username?`, `name?`, `phone?`, `roleIds?[]` |
| `POST /admin/roles` | `name` | `description?`, `permissionKeys?[]` (alias lama: `permissions?[]`) |
| `PUT /admin/roles/:id/permissions` | — | `permissionKeys?[]` / `permissions?[]` (alias lama) |
| `POST /admin/permissions` | `key` | `description?`, `isProtected?` |
| `POST /admin/menus` | `name` | `url?`, `icon?`, `parentId?`, `permissionIds?[]`, `order?`, `description?`, `isActive?` |
| `PUT /admin/menus/:id/permissions` | `permissionIds[]` | — |
| `PUT /admin/users/:id/roles` | `roleIds[]` | — |
| `PUT /admin/users/:id/role` | `roleId` | — |
| `POST /admin/delegations` | `granteeId`, `permissionKeys[]`, `expiresAt` | — |

ID/key yang tidak dikenal → `400`; field opsional yang tidak dikirim tidak dianggap error.

## 2. Authentication

| Method | Path | Akses | Body / Query | Respons |
|---|---|---|---|---|
| POST | `/auth/register` | Publik | `{ email, password (min 6), username? }` | `{ id, email, username }` |
| POST | `/auth/login` | Publik | `{ email, password }` | `{ accessToken }` |
| GET | `/auth/me` | Token | — | `{ id, email, username, role, roles[], permissions[], canonicalPermissions[], legacyPermissions[], menus[] }` |

`username` kosong → generate deterministik dari email (dokumen 07 M2 langkah 1). JWT payload tetap `{ sub }`.

Rate limit: `POST /auth/login` maksimal 10 request per IP per 15 menit (`AUTH_LOGIN_RATE_LIMIT`, `AUTH_LOGIN_RATE_TTL_MS`). Guard hanya pada endpoint login, storage in-memory per process, `X-Forwarded-For` tidak dipercaya. Lebih dari batas → `429`. Akun nonaktif, password salah, dan email tidak dikenal memakai pesan 401 yang sama.

```json
{
  "id": "uuid",
  "email": "superadmin@example.com",
  "username": "superadmin",
  "role": "superadmin",
  "roles": [{ "id": "uuid", "name": "superadmin", "isSystem": true }],
  "permissions": ["manage:user", "read:article", "read:menu", "user.manage", "article.read"],
  "canonicalPermissions": ["manage:user", "read:article", "read:menu"],
  "legacyPermissions": ["article.read", "user.manage"],
  "menus": [
    {
      "id": "uuid", "name": "User Management", "url": null,
      "icon": "pi-list-fw pi-users", "parentId": null, "order": 1,
      "description": null,
      "children": [
        { "id": "uuid", "name": "Menu", "url": "/menus", "icon": "pi-list-fw pi-bars",
          "parentId": "uuid", "order": 1, "description": null, "children": [] }
      ]
    }
  ]
}
```

`permissions` sengaja berisi key kanonik **dan** alias legacy untuk klien lama; gunakan `canonicalPermissions` untuk pengecekan baru. Field `role` adalah field kompatibilitas legacy berupa nama role tunggal dan **bisa bernilai `null`** (user tanpa role); untuk logika baru gunakan `roles[]`. Node `menus` di sini adalah hasil filter visibilitas (tanpa `permissions`/`isActive`), berbeda dengan tree dari `GET /admin/menus` (F-08).

## 3. User management

| Method | Path | Permission | Body / Query |
|---|---|---|---|
| GET | `/admin/users` | `read:user` | `?page=1&limit=10&search=` |
| POST | `/admin/users` | `create:user` | `{ email, password, username?, name?, phone?, roleIds?[] }` |
| GET | `/admin/users/:id` | `read:user` | — |
| PATCH | `/admin/users/:id` | `update:user` | `{ name?, phone?, isActive? }` |
| DELETE | `/admin/users/:id` | `delete:user` | — |
| PUT | `/admin/users/:id/roles` | `update:user` | `{ roleIds[] }` |
| POST | `/admin/users/:id/roles/:roleId` | `update:user` | — |
| DELETE | `/admin/users/:id/roles/:roleId` | `update:user` | — |
| PUT | `/admin/users/:id/role` | `manage:user` | **Deprecated alias** single-role, body `{ roleId }` |
| DELETE | `/admin/users/:id/role` | `manage:user` | **Deprecated alias** cabut role tunggal |

Aturan: tidak boleh mengubah/menghapus diri sendiri (termasuk self-deactivation); tidak boleh memberi/mengubah `superadmin`; username unik case-insensitive; email duplikat → `409`. Role yang diberikan non-superadmin harus berada di dalam permission ∩ capability actor.

## 4. Role management

| Method | Path | Permission | Body / Query |
|---|---|---|---|
| GET | `/admin/roles` | `read:role` | `?page&limit&search` |
| POST | `/admin/roles` | `create:role` | `{ name, description?, permissionKeys?[] }` |
| GET | `/admin/roles/:id` | `read:role` | — |
| PATCH | `/admin/roles/:id` | `update:role` | `{ name?, description? }` |
| DELETE | `/admin/roles/:id` | `delete:role` | — |
| PUT | `/admin/roles/:id/permissions` | `update:role` | `{ permissionKeys?[], permissions?[] }` — path existing dipertahankan; **mengganti seluruh** permission role |

Respons: `{ id, name, description, isSystem, permissions: string[], usersCount, createdAt }`. `PATCH`, `DELETE`, dan `PUT .../permissions` pada `superadmin` → `403` (dokumen 05 §7.1).

`POST /admin/roles`: untuk actor non-`superadmin`, **setiap** `permissionKeys[]` divalidasi ⊆ capability actor dan ⊆ permission actor — pemeriksaan subset dilakukan **saat create**, tidak hanya saat set permission kemudian (dokumen 05 §7.2 aturan 5).

`PUT /admin/roles/:id/permissions` **mengganti seluruh daftar permission role**, bukan menambahkan. Service menghitung `permissionKeys ?? permissions ?? []`:
- Jika `permissionKeys` dikirim, field itulah yang dipakai (prioritas lebih tinggi daripada alias lama `permissions`).
- Jika hanya `permissions` yang dikirim, alias lama itu dipakai.
- Jika **kedua field tidak dikirim**, service memakai `[]` sehingga seluruh assignment permission role dihapus.
- Array kosong (`[]`) juga menghapus seluruh assignment permission role.

## 5. Permission management

| Method | Path | Permission | Body / Query |
|---|---|---|---|
| GET | `/admin/permissions` | `read:permission` | `?page&limit&search`; menyertakan `roles[]` |
| POST | `/admin/permissions` | `create:permission` | `{ key, description?, isProtected? }` — key `action:resource`; `isProtected?` hanya boleh `true` untuk `superadmin`; **transaksional: permission otomatis ditambahkan ke role `superadmin`** |
| GET | `/admin/permissions/:id` | `read:permission` | — |
| PATCH | `/admin/permissions/:id` | `update:permission` | `{ description?, isProtected? }` (key tidak bisa diubah) |
| DELETE | `/admin/permissions/:id` | `delete:permission` | `409` jika masih dipakai |
| GET | `/admin/permissions/drift` | `read:permission` | — |

```json
{ "orphan": ["legacy:unused"], "unregistered": [] }
```

Hanya melapor; tidak membuat endpoint/permission. **Setiap endpoint terproteksi wajib ada di policy registry**; temuan `unregistered` harus dibereskan sebelum deploy (dokumen 05 §8). Saat ini seluruh endpoint aktif sudah terdaftar, sehingga `unregistered` kosong bila permission di database lengkap.

Aturan permission terhadap role sistem:
- `POST /admin/permissions` → buat `Permission` **dan** `RolePermission` untuk `superadmin` dalam **satu transaksi**; gagal di tengah → rollback keduanya.
- `PATCH /admin/permissions/:id`: `description` dapat diubah selama permission bukan protected dan actor memiliki akses. **`isProtected` hanya dapat diubah oleh `superadmin`**; bukan superadmin yang mencoba mengubahnya memperoleh `403`.
- `DELETE /admin/permissions/:id` ditolak (`409`) bila permission masih dipakai oleh **role (termasuk `superadmin`), menu, maupun capability delegasi**. Permission protected juga tidak bisa dihapus oleh non-superadmin (`403`).
- Satu-satunya jalur API yang menambah permission ke role sistem adalah `POST /admin/permissions` di atas; `PUT /admin/roles/:id/permissions` pada `superadmin` tetap `403`.

## 6. Menu management

| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/menus` | `read:menu` | tree utuh; `page`/`limit` hanya dibalas, tidak memotong hasil |
| POST | `/admin/menus` | `create:menu` | `{ name, url?, icon?, parentId?, permissionIds?[], order?, description?, isActive? }` |
| GET | `/admin/menus/:id` | `read:menu` | — |
| PATCH | `/admin/menus/:id` | `update:menu` | field sama |
| DELETE | `/admin/menus/:id` | `delete:menu` | anak jadi root |
| PUT | `/admin/menus/:id/permissions` | `update:menu` | `{ permissionIds[] }` — wajib (array, boleh kosong untuk menghapus semua) |

Validasi: `url` diawali `/`; `icon` pola PrimeIcons; **siklus `Menu.parentId` dilarang keras** — service memvalidasi graph saat update dan menolak (`400`) jika terbentuk siklus langsung maupun transitif.

Dua bentuk respons menu yang berbeda (F-08):
- `GET /admin/menus` → tree pengelolaan: `id`, `name`, `url`, `icon`, `parentId`, `order`, `description`, `isActive`, `permissions[]` (key permission), `createdAt`, `updatedAt`, `children[]`.
- `menus[]` pada `/auth/me` → tree hasil filter visibilitas: `id`, `name`, `url`, `icon`, `parentId`, `order`, `description`, `children[]` (tanpa `permissions` dan `isActive`).

Filter visibilitas: menu tanpa permission mapping disembunyikan, menu dengan permission memakai ANY-of, dan submenu dari parent yang tersembunyi ikut disembunyikan (F-02).

## 7. Delegated administration

| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/delegations` | `read:delegation` | `?granteeId` |
| POST | `/admin/delegations` | `create:delegation` | `{ granteeId, permissionKeys[], expiresAt }` |
| DELETE | `/admin/delegations/:id` | `delete:delegation` | UUID `AdminCapability` |

`expiresAt` wajib, masa depan, ≤ 90 hari. 13 aturan di dokumen 05 §7.2 **dan mekanisme lineage di §7.3** berlaku.

`parentCapabilityId` **ditentukan server**, bukan input klien: saat create, capability baru menunjuk ke capability actor yang dipakai sebagai sumber (root = `null` hanya untuk grant langsung `superadmin`). Respons aktual (F-04): `{ id, granteeId, permissionKey, grantedBy, parentCapabilityId, grantedAt, expiresAt }`; daftar juga menyertakan `valid`. Mencabut ancestor (`DELETE`) → descendant ikut terhapus via cascade. Ancestor expired → descendant langsung dianggap tidak valid oleh fail-closed check; baris lama tidak dihapus otomatis, tetapi diganti saat re-grant.

## 8. Audit log

| Method | Path | Permission | Query |
|---|---|---|---|
| GET | `/admin/audit-logs` | `read:audit` | `?actorId&action&resourceType&resourceId&from&to&page&limit` |

Field `before/after` sudah diredaksi; retention default 365 hari dikendalikan `AUDIT_RETENTION_DAYS` dan dijalankan scheduler harian 02:00 WIB (batch maksimal 1000 ID, idempoten). Cleanup tidak menulis Audit Log baru. **`AuditLog.action` memakai `resource.action`** (mis. `user.create`, `role.permissions.update`) dan **bukan** permission key `action:resource` (mis. `create:user`). Keduanya berbeda dan tidak boleh disamakan.

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
| 401 | Token tidak ada/tidak valid/kedaluwarsa, user nonaktif, email/password salah |
| 403 | Permission kurang, delegasi/eskalasi dilanggar, aksi ke diri sendiri, role sistem disentuh |
| 429 | Batas rate limit `POST /auth/login` terlampaui |
| 404 | Tidak ditemukan |
| 409 | Email/username/role duplikat; role/permission masih dipakai |

## 11. Konsistensi

Nama tabel/field mengikuti `04-prisma-schema-proposal.prisma`; permission key `action:resource` mengikuti D1; mapping key lama → baru dan verifikasinya ada di dokumen 07. Tidak ada endpoint yang dibuat otomatis dari baris `Permission`.
