# Phase 01 — Migration, Security & Testing (final revision)

> Rencana di bawah **belum dieksekusi**. Phase 01 hanya dokumentasi. Tidak ada migrasi dibuat/dijalankan, dan Supabase tidak disentuh.

## 1. Strategi migrasi

**Additive → backfill → switch → cleanup.** Kolom lama, assignment, dan tabel `Article` dipertahankan sampai verifikasi. Perubahan key permission dilakukan dengan **mapping eksplisit**, bukan wildcard.

### M0 — Preflight

1. Backup penuh Supabase (dump + PITR bila ada).
2. Freeze write administratif.
3. Rekam baseline:
   - jumlah baris per tabel;
   - **himpunan permission per user** dengan key lama (`resource.action`) — akan dibandingkan setelah dinormalisasi ke `action:resource`;
   - **Article**: jumlah baris + smoke test `GET /articles` dengan `article.read` (key lama);
   - konfirmasi migrasi lokal `20261117070522_add_article` sudah applied.
4. **Deteksi kolisi key permission — WAJIB.** Sebelum M2.4 dijalankan, periksa apakah key tujuan (`read:article`, `create:article`, `update:article`, `delete:article`, `manage:user`) sudah terpakai oleh permission lain di tabel `Permission`. Jika ada satu pun kolisi: **HENTIKAN migrasi** dan minta rekonsiliasi eksplisit dari project owner. Jangan pernah menghapus, menimpa, atau menggabungkan permission yang bentrok.
5. Pastikan fitur Article working tree sudah ter-commit/ter-deploy lebih dulu.
6. Siapkan script rollback (§6).

### M1 — Additive (tanpa drop)

```sql
CREATE EXTENSION IF NOT EXISTS citext;
```

Tabel baru: `UserRole`, `Menu`, `MenuPermission`, `AdminCapability`, `AuditLog`.

Kolom baru:
- `User`: `username citext` (nullable dulu), `name`, `phone`, `isActive DEFAULT true`, `createdAt DEFAULT now()`, `updatedAt` (**nullable dulu** — prosedur di bawah).
- `Role`: `description`, `isSystem DEFAULT false`, `updatedAt` (**nullable dulu** — prosedur di bawah).
- `Permission`: `description`, `isProtected DEFAULT false`, `createdAt DEFAULT now()`.
- `User.roleId` **tidak diubah** (`legacyRoleId` via `@map("roleId")`).

**Prosedur aman `updatedAt` untuk data existing.** Tambahkan sebagai `TIMESTAMP NULL`, backfill, lalu baru `SET NOT NULL`. Tidak ada baris lama yang ditolak:

```sql
-- User: createdAt sudah ditambahkan M1 dengan DEFAULT now()
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP NULL;
UPDATE "User" SET "updatedAt" = COALESCE("createdAt", now()) WHERE "updatedAt" IS NULL;
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Role: createdAt sudah ada sejak migrasi awal
ALTER TABLE "Role" ADD COLUMN "updatedAt" TIMESTAMP NULL;
UPDATE "Role" SET "updatedAt" = COALESCE("createdAt", now()) WHERE "updatedAt" IS NULL;
ALTER TABLE "Role" ALTER COLUMN "updatedAt" SET NOT NULL;
```

`@updatedAt` di Prisma hanya mengatur penulisan oleh aplikasi, bukan keharusan pada saat DDL; karenanya urutan **add nullable → backfill → SET NOT NULL** tetap dipakai.

### M2 — Backfill + switch (satu rilis terkoordinasi)

#### Langkah 1 — Backfill username (deterministik)

Urutan: `ORDER BY "createdAt" ASC, id ASC`. Fungsi murni, tanpa random/timestamp:

```
usernameFor(email, used):
  base = lowercase(bagian email sebelum '@')
  base = ganti tiap karakter selain [a-z0-9_] dengan '_'
  base = potong(base, 30)
  if base kosong       -> base = "user"
  if panjang(base) < 3 -> tambah '_' sampai panjang 3
  candidate = base
  n = 1
  while lowercase(candidate) ada di used:
      suffix    = "_" + n
      candidate = potong(base, 30 - panjang(suffix)) + suffix
      n = n + 1
  used.add(lowercase(candidate))
  return candidate
```

- **Deterministik**: input sama → output sama, bisa di-replay.
- **Case-insensitive**: collision dicek dengan `lowercase()`, ditegakkan `citext` + unique index.
- **≤ 30 karakter**: berlaku untuk `base` dan `candidate` akhir termasuk suffix.
- Format akhir `[a-z0-9_]{3,30}`.

Setelah terisi: `SET NOT NULL` + unique index. Aplikasi memakai fungsi sama untuk register publik dan validasi `@Matches(/^[a-z0-9_]{3,30}$/)`.

#### Langkah 2 — Backfill UserRole
```sql
INSERT INTO "UserRole" ("userId", "roleId", "assignedAt")
SELECT id, "roleId", now() FROM "User" WHERE "roleId" IS NOT NULL
ON CONFLICT DO NOTHING;
```

#### Langkah 3 — Rename role sistem
```sql
UPDATE "Role" SET name = 'superadmin', "isSystem" = true WHERE name = 'Admin';
```

#### Langkah 4 — Migrasi key permission ke `action:resource`

Mapping **eksplisit**, satu per key:

| Key lama | Key baru |
|---|---|
| `article.read` | `read:article` |
| `article.create` | `create:article` |
| `article.update` | `update:article` |
| `article.delete` | `delete:article` |
| `user.manage` | `manage:user` |

```sql
UPDATE "Permission" SET key = 'read:article'   WHERE key = 'article.read';
UPDATE "Permission" SET key = 'create:article' WHERE key = 'article.create';
UPDATE "Permission" SET key = 'update:article' WHERE key = 'article.update';
UPDATE "Permission" SET key = 'delete:article' WHERE key = 'article.delete';
UPDATE "Permission" SET key = 'manage:user'    WHERE key = 'user.manage';
```

`RolePermission` dan `MenuPermission` mereferensikan `Permission.id`, jadi **assignment tidak terputus**. Jika ada key lama tambahan di database yang tidak ada di mapping → migrasi **gagal** (fail closed), bukan di-skip.

**Aturan kolisi (ulang preflight M0.4 di dalam transaksi M2.4):** untuk setiap key tujuan, jika sudah ada baris `Permission` dengan key tersebut dan baris itu **bukan** sumber yang sedang diubah → **batalkan seluruh M2**. Dilarang `ON CONFLICT DO UPDATE`, overwrite, merge, atau delete otomatis. Rekonsiliasi harus eksplisit dari project owner (mis. memberi nama berbeda pada permission baru), setelah itu M0–M2 diulang dari backup. Tidak ada silent reconciliation.

#### Langkah 5 — Tandai protected
`isProtected = true` untuk `manage:user` dan `grant:admin`.

#### Langkah 6 — Seed permission baru (format `action:resource`)
`read:user`, `create:user`, `update:user`, `delete:user`, `read:role`, `create:role`, `update:role`, `delete:role`, `read:permission`, `create:permission`, `update:permission`, `delete:permission`, `read:menu`, `create:menu`, `update:menu`, `delete:menu`, `read:delegation`, `create:delegation`, `delete:delegation`, `read:audit`, `grant:admin`.

Semua mengikuti pola `action:resource`; tidak ada pengecualian format.

#### Langkah 7 — Permission role sistem
Berikan seluruh permission kepada `superadmin`. Penambahan key baru hanya pada role ini; key hasil mapping tetap melekat pada role pemiliknya (§2).

#### Langkah 8 — Deploy kode baru (rilis yang sama)
- `AuthorizationService`, guards, endpoint baru.
- **Semua deklarasi guard** diganti ke key baru: `article.read` → `read:article`, `user.manage` → `manage:user`, dll.
- **`RegisterDto` @MinLength(8) → 6** (D5).
- `AdminCapability` dibuat dengan self-FK `parentCapabilityId` (`onDelete: Cascade`) untuk lineage; job cleanup capability expired ikut menghapus descendant.
- `ValidationPipe({ whitelist: true, transform: true })` — `forbidNonWhitelisted` **tidak** diaktifkan.
- **Semua endpoint terproteksi** terdaftar di policy registry; tidak ada deklarasi guard di luar registry.
- `POST /admin/permissions` menambahkan permission baru ke `superadmin` dalam satu transaksi.
- Frontend multi-select role & key filter diperbarui.

#### Langkah 9 — Verifikasi & unfreeze
Lihat §2. Gagal → rollback M0, jangan lanjut M3.

### M3 — Cleanup (approval terpisah)

- Hapus FK & kolom `User.roleId` (O2 — atau simpan sebagai arsip).
- Hapus alias single-role setelah frontend tidak memakainya.

## 2. Verifikasi preservasi (permission, username, Article)

| Pemeriksaan | Ekspektasi |
|---|---|
| Himpunan permission per user | Baseline M0 **dinormalisasi** lewat mapping (§M2.4) → identik dengan kondisi setelah migrasi. Tidak ada permission hilang/bertambah di role non-sistem. |
| `SELECT count(*) FROM "Permission" WHERE key LIKE '%.%'` | 0 (semua key sudah `action:resource`) |
| `SELECT count(*) FROM "Permission" WHERE key IN ('read:article','create:article','update:article','delete:article','manage:user')` | 5 |
| `SELECT count(*) FROM "UserRole"` | = user ber-`roleId` lama (sebelum M3) |
| `SELECT count(*) FROM "Role" WHERE name = 'Admin'` | 0 |
| `SELECT count(*) FROM "User" WHERE username IS NULL` | 0 |
| Username duplikat case-insensitive | `SELECT lower(username) FROM "User" GROUP BY 1 HAVING count(*) > 1` → 0 baris |
| `max(length(username))` | ≤ 30 |
| **Article count** | Sama dengan baseline M0 |
| **Article smoke test** | `GET /articles` 200 dengan `read:article`; `POST`/`PUT`/`DELETE` 200/201 dengan `create:article`/`update:article`/`delete:article` |
| Migrasi Article | `20261117070522_add_article` tercatat applied |
| Login + `/auth/me` | Role, permission (key baru), menu tampil |
| Preflight kolisi key | 0 kolisi; jika ada, M0.4 menghentikan migrasi sebelum perubahan apa pun |
| `updatedAt` existing | `SELECT count(*) FROM "User" WHERE "updatedAt" IS NULL` = 0; idem untuk `Role`; kolom `NOT NULL` |
| Lineage capability | `parentCapabilityId` terisi untuk capability turunan, `null` untuk root; cascade aktif |
| Cakupan policy registry | `drift.unregistered` kosong untuk endpoint yang sudah di-deploy |

Jika ada permission yang tidak bisa dipetakan, kolisi, `updatedAt` gagal, atau Article gagal → rollback M0.

## 3. Contoh backfill username

| Email | Username |
|---|---|
| `sales@example.com` | `sales` |
| `Sales.2@example.com` | `sales_2` |
| `a@example.com` | `a__` |
| email local-part 35 char | 30 char pertama |

Duplikat local-part → `sales`, `sales_1`, `sales_2`, sesuai urutan `id`.

## 4. Risiko keamanan

| Risiko | Sumber | Mitigasi |
|---|---|---|
| XSS token `localStorage` | Existing | O3. |
| Brute force login | Existing | `@nestjs/throttler` lanjutan. |
| Validasi longgar | Existing | **Selaraskan** ke `ValidationPipe({ whitelist: true, transform: true })`; `forbidNonWhitelisted` sengaja **off** (field asing dibuang). Identik di doc 02 & 06. |
| Konstanta hardcoded diduplikasi | Existing | `isSystem`/`isProtected` + konstanta pusat. |
| Username case-sensitive duplikat | Target | `citext` + unique + lowercase + backfill deterministik. |
| Username > 30 / karakter aneh | Target | Regex `[a-z0-9_]{3,30}`. |
| **Rename key merusak guard** | Target (D1) | Mapping eksplisit + deploy kode rilis sama + fail closed + verifikasi §2. |
| **Password 6 lebih lemah dari 8** | Target (D5) | Requirement mentor eksplisit; mitigasi: rate limit login, bcrypt salt 10, audit login. |
| Hapus `Permission` cascade | Existing/target | Tolak `409` jika dipakai + audit. |
| Eskalasi rantai capability | Target | 13 aturan dokumen 05 §7.2 + lineage §7.3 (`parentCapabilityId`, trace ancestor, cascade invalidasi). |
| Ancestor expired tapi baris belum dihapus job | Target | `resolvePrincipal` menolak descendant jika ada ancestor `expiresAt <= now()` (fail closed) sebelum cleanup. |
| Eskalasi via role tambahan | Target | Aturan 5: permission role ⊆ capability. |
| Self-escalasi role sendiri | Target | Aturan 6. |
| PII/secret di audit | Target | Redaction whitelist + retention (§5). |

## 5. AuditLog — retention & redaction

**Retention:** default **365 hari** (`AUDIT_RETENTION_DAYS`), job harian batch 1000 idempoten; baris > 365 hari dihapus. Penghapusan job tidak ditulis ke audit (rekursi), cukup log aplikasi. `actorEmail` snapshot tetap penuh.

**Redaction whitelist** (`AuditService.redact`):

| resourceType | Field disimpan |
|---|---|
| `user` | `id`, `email`, `username`, `name`, `phone` (masked), `isActive`, `roles`/`roleIds` |
| `role` | `id`, `name`, `description`, `permissionKeys` |
| `permission` | `id`, `key`, `description`, `isProtected` |
| `menu` | `id`, `name`, `url`, `icon`, `parentId`, `order`, `isActive`, `permissionIds` |
| `delegation` | `id`, `granteeId`, `permissionKey`, `grantedBy`, `parentCapabilityId`, `invalidatedDescendantIds`, `expiresAt` |

- Dilarang: `password`, `passwordHash`, `accessToken`, `refreshToken`, `jwt`, `secret`, `otp`, token reset.
- `phone` → `****1234`; `email` di `before/after` → `s***@example.com`; `actorEmail` tetap penuh.
- `userAgent` ≤ 512 char; `ip` apa adanya.
- Field di luar whitelist **dibuang**.

**Pembeda nama:** permission key = **`action:resource`** (mis. `create:user`); `AuditLog.action` = **`resource.action`** (mis. `user.create`). Keduanya berbeda; `AuditLog.action` bukan permission key dan tidak boleh dipakai sebagai dasar `PermissionsGuard`.

## 6. Rollback

- **M1**: drop tabel/kolom baru; drop `citext` jika tidak dipakai objek lain.
- **M2**: restore backup M0 + deploy kode lama (ada rename role, username, dan key permission).
- **M3**: jangan dijalankan sebelum M2 final; setelahnya butuh restore backup.

## 7. Aturan validasi

| Entity | Aturan |
|---|---|
| `User` | Email unik; `username` `[a-z0-9_]{3,30}` unik case-insensitive; **password min 6**; `roleIds[]` ada & bukan `isSystem`; tidak bisa mengubah diri sendiri. |
| `Role` | `name` unik; tidak bisa pakai `superadmin`; role sistem immutable di 3 ranah; `permissionKeys[]` ada **dan** (actor non-superadmin) ⊆ capability actor **saat create**, bukan hanya saat set permission. |
| `Permission` | `key` `^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$` & unik; `isProtected` hanya oleh `superadmin`; `POST` transaksional menambahkan ke `superadmin`; `PATCH/DELETE` tidak boleh menyentuh permission role sistem. |
| `Menu` | `url` diawali `/`; `icon` PrimeIcons; **siklus `parentId` dilarang keras** (validasi graph, langsung/transitif); `permissionIds[]` ada. |
| `AdminCapability` | ≠ actor/grantor; `grant:admin` non-delegable; `create:delegation` satu level; subset capability; role target ⊆ capability; asiklik; `parentCapabilityId` menunjuk sumber valid (root `null` hanya untuk `superadmin`); `expiresAt` > now ≤ 90 hari; ancestor expired/cabut → descendant invalid. |
| `AuditLog` | Transaksional; `actorEmail` wajib; payload diredaksi; retention 365 hari. |

Validasi global: **`ValidationPipe({ whitelist: true, transform: true })`**, `forbidNonWhitelisted` tidak diaktifkan. Konsisten dengan dokumen 02 dan 06.

## 8. Test scenario

| # | Skenario | Ekspektasi |
|---|---|---|
| 1 | Register password 5 karakter | 400 (min 6) |
| 2 | Register password 6 karakter | 201 |
| 3 | Register tanpa username | 201, username deterministik |
| 4 | `Admin` ada, daftar `admin` | 409 case-insensitive |
| 5 | Username 31 karakter | 400 |
| 6 | Backfill username diulang | Identik |
| 7 | `/auth/me` | Key `action:resource` (`manage:user`, `read:article`) |
| 8 | User 2 role | Permission = union |
| 9 | Cabut role | Langsung berlaku tanpa re-login |
| 10 | User tanpa role → `/admin/users` | 403 |
| 11 | ALL-of gagal 1 | 403 |
| 12 | ANY-of lolos 1 | 200 |
| 13 | `superadmin` di-PATCH/DELETE/assign | 403 (3 ranah) |
| 14 | `PUT .../superadmin/permissions` | 403 |
| 15 | `isProtected` ke role non-sistem | 403 |
| 16 | Aksi ke diri sendiri | 403 |
| 17 | Ubah permission role sendiri | 403 |
| 18 | Delegate pakai alias `manage:user` saja | 403 |
| 19 | Delegate sesuai capability | 201 + audit |
| 20 | Role target punya permission di luar capability | 403 |
| 21 | Graf delegasi siklus | 403 |
| 22 | Grantor dicabut → turunan hilang | Tidak berlaku |
| 23 | Delegate `grant:admin` / lanjutkan `create:delegation` | 403 |
| 24 | `expiresAt` 91 hari / lampau | 400 |
| 25 | Menu tanpa permission | Muncul |
| 26 | Menu 2 permission, user punya 1 | Muncul (ANY-of) |
| 27 | Parent tak memenuhi syarat | Anak tersembunyi |
| 28 | Permission baru tak dipakai endpoint | `drift.orphan`, tanpa endpoint |
| 29 | Hapus permission dipakai | 409 |
| 30 | Aksi admin sukses | Audit whitelist benar |
| 31 | Payload ada password/token | Tidak tersimpan |
| 32 | Phone/email audit | `****1234` / `s***@example.com` |
| 33 | Audit > 365 hari | Dihapus job |
| 34 | Transaksi gagal | Mutasi + audit rollback |
| 35 | Backfill | `UserRole` benar, username valid |
| 36 | **Mapping key** | 5 key lama → 5 key baru; assignment identik; tidak ada key `%.%` |
| 37 | **Article** | Count sama; 4 endpoint lolos dengan `read:article`, `create:article`, `update:article`, `delete:article` |
| 38 | Preflight: key tujuan `read:article` sudah dipakai permission lain | Migrasi **dihentikan**; tidak ada overwrite/merge/delete; perlu rekonsiliasi eksplisit |
| 39 | `updatedAt` existing User/Role | Terisi dari `createdAt`/`now()`, `NOT NULL`, tidak ada baris gagal |
| 40 | `POST /admin/permissions` | `Permission` + `RolePermission` untuk `superadmin` dibuat satu transaksi; gagal di tengah → rollback keduanya |
| 41 | `PATCH/DELETE` permission yang melekat di `superadmin` | Ditolak (`403`/`409`); permission tidak hilang |
| 42 | `POST /admin/roles` dengan `permissionKeys[]` di luar capability | `403` **saat create** |
| 43 | `POST /admin/delegations` | `parentCapabilityId` diisi server-side; root `null` hanya untuk grant `superadmin` |
| 44 | Cabut capability ancestor / ancestor expired | Descendant tidak berlaku langsung & ikut terhapus (cascade + chain check) |
| 45 | Endpoint terproteksi tanpa entri policy registry | Tidak boleh di-deploy; `drift.unregistered` dilaporkan sebagai pelanggaran |
| 46 | `Menu.parentId` membentuk siklus | `400`, tidak tersimpan |

## 9. Validation results Phase 01

- ✅ Pilihan user dipertahankan: `action:resource` (D1) dan password 6 (D5), keduanya berjustifikasi requirement mentor eksplisit.
- ✅ Mapping key lama → baru eksplisit & fail closed; FK berbasis `id` menjaga assignment.
- ✅ Username: deterministik, case-insensitive (`citext`), ≤ 30 karakter.
- ✅ `superadmin`: 3 ranah proteksi + bootstrap/recovery; 13 aturan delegasi (asiklik, invalidasi rantai, subset role saat create & assign, TTL 90 hari).
- ✅ Lineage: `parentCapabilityId`, trace ancestor, invalidasi dua lapis, siklus dilarang.
- ✅ `updatedAt`: add nullable → backfill → `SET NOT NULL` untuk User & Role.
- ✅ Kolisi key: preflight M0.4 + abort M2.4; tanpa overwrite/merge/delete.
- ✅ `POST /admin/permissions` transaksional menambah ke `superadmin`; permission sistem tidak bisa diubah/dihapus via API.
- ✅ Validasi global `whitelist + transform` konsisten di doc 02/06/07; siklus Menu dilarang; policy registry wajib untuk semua endpoint terproteksi.
- ✅ Audit: retention 365 hari + redaction whitelist; `action:resource` (permission) dibedakan dari `resource.action` (AuditLog.action).
- ✅ Preservasi permission & Article diverifikasi (§2, test 36–37).
- ✅ Tidak ada source/schema/migrasi/dependency/Supabase yang diubah.
- ⏹ Menunggu approval Phase 02.
