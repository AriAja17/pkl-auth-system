# Phase 01 — Existing System Audit (final revision)

Audit terhadap **working tree lokal**. GitHub remote tidak dipakai (tertinggal).

## 1. Stack yang berjalan

| Bagian | Versi / konfigurasi | Bukti |
|---|---|---|
| Backend | NestJS 12, `@nestjs/jwt` 12, Express | `auth-backend/package.json:24-28` |
| Frontend | Next.js 16.4.6 (App Router), React 19.3, Tailwind 4 | `auth-frontend/package.json:12-24` |
| ORM | Prisma 7.10.1, generator `prisma-client`, output `src/generated/prisma`, `moduleFormat = cjs`, `@prisma/adapter-pg` | `prisma/schema.prisma:1-9`, `src/prisma/prisma.service.ts:1-15` |
| Database | PostgreSQL (Supabase) | `prisma/schema.prisma:7-9` |
| Auth | JWT `expiresIn: '1d'`, payload `{ sub }`, bcryptjs salt 10, password **min 8 (existing)** → target **6 (D5)** | `auth.module.ts:9-16`, `auth.service.ts:27,48`, `dto/register.dto.ts:8` |
| Validasi | `class-validator` + `ValidationPipe({ whitelist: true })` | `src/main.ts:7` |
| CORS | `http://localhost:3000` | `src/main.ts:8` |

Mekanisme auth dipertahankan; hanya batas password yang diubah sesuai requirement mentor.

## 2. Model data existing (local)

```
User { id, email @unique, password, roleId? -> Role }
Role { id, name @unique, createdAt, users[], permissions[] }
Permission { id, key @unique, roles[] }
RolePermission { roleId, permissionsId, @@id([roleId, permissionsId]) }
Article { id, title, content, createdAt, updatedAt }   // working tree, belum ter-commit
```

Bukti: `prisma/schema.prisma:11-48`, `migrations/20261112022214_init/migration.sql`, `migrations/20261117070522_add_article/migration.sql`, `src/articles/`.

- `roleId` FK nullable, `onDelete: Restrict` (`schema.prisma:16`).
- Kolom join bernama **`permissionsId`** — dipertahankan untuk kompatibilitas.
- Permission key existing berformat **`resource.action`**: `article.read/create/update/delete`, `user.manage` (`prisma/seed.ts:13-19`).
- Tidak ada `Menu`, `AuditLog`, `username`, `name`, `phone`, `isActive`, `isSystem`, `isProtected`.

## 3. Alur autentikasi & otorisasi existing

1. `POST /auth/register` → user tanpa role (`auth.service.ts:19-34`).
2. `POST /auth/login` → JWT `{ sub }` (`auth.service.ts:36-50`).
3. `JwtAuthGuard` verifikasi token + memuat `role → permissions → permission` **setiap request** (`guards/jwt-auth.guard.ts:17-50`).
4. `PermissionsGuard` mensyaratkan **semua** permission (`required.every(...)`) (`guards/permissions.guard.ts:14-31`).
5. `PrismaModule` `@Global` → `PrismaService` tersedia global (`prisma/prisma.module.ts:1-9`).

Kelebihan dipertahankan: perubahan role/permission langsung berlaku tanpa login ulang.

## 4. Kemampuan admin existing

`AdminController` (`src/admin/admin.controller.ts:20-74`) dengan `@RequirePermissions('user.manage')`:

| Endpoint | Fungsi |
|---|---|
| `GET /admin/users`, `/admin/roles`, `/admin/permissions` | Read |
| `POST /admin/roles` | Buat role + permission |
| `PUT /admin/roles/:id/permissions` | Ganti permission role (transaksi, `admin.service.ts:121-126`) |
| `DELETE /admin/roles/:id` | Hapus role (ditolak jika dipakai, `:144-149`) |
| `PUT /admin/users/:id/role` | **Menimpa** `roleId` (`admin.service.ts:183`) — single-role |
| `DELETE /admin/users/:id/role` | `roleId = null` (`:203-206`) |
| `DELETE /admin/users/:id` | Hapus user |

Proteksi hardcoded-existing, dibedakan menurut ranah:

| Ranah | Perilaku existing | Bukti |
|---|---|---|
| Konfigurasi role | Role `Admin` tidak bisa diubah/dihapus | `admin.service.ts:115-117`, `:140-142` |
| Assignment user-role | Role `Admin` tidak bisa diberikan; role user Admin tidak bisa diubah; admin tidak bisa mengubah role diri sendiri | `:169-181`, `:158-160`, `:188-190` |
| Manajemen permission | `user.manage` ditolak untuk role selain Admin; admin tidak bisa menghapus akun sendiri | `:51-55`, `:211-213` |

`PROTECTED_ROLE = 'Admin'` dan `PROTECTED_PERMISSION = 'user.manage'` (`admin.service.ts:10-11`) diduplikasi di frontend (`app/admin/page.tsx:21-22`). Articles pakai `article.read/create/update/delete` (`articles.controller.ts:22-43`).

## 5. Frontend & testing existing

- Token di `localStorage` (`lib/api.ts:12-23`); header Bearer di `api()` (`:25-55`).
- `/dashboard` menampilkan satu role + permission; tautan di-filter `permissions.includes(...)` (`dashboard/page.tsx:66-104`).
- `/admin` monolit ~484 baris (`admin/page.tsx`), tanpa create user/menu/audit; navigasi hardcode.
- Test hanya `app.controller.spec.ts` + e2e `GET /` → `"Hello World!"`; tidak ada test guard/admin/Article/migrasi.

## 6. Celah terhadap requirement

| Requirement | Existing | Gap |
|---|---|---|
| 1. Multi-role user | `roleId` tunggal | `UserRole` + UI multi-select |
| 2. Dynamic role | Ada | `description`, `isSystem`, pagination |
| 3. Dynamic permission | Ada via seed, tanpa CRUD | CRUD + format `action:resource` + migrasi key + drift report |
| 4. Dynamic menu | Tidak ada | `Menu`, `MenuPermission`, tree, filter backend |
| 5. Delegated administration | Tidak ada | `AdminCapability` + 13 aturan |
| 6. Audit | Tidak ada | `AuditLog` + retensi + redaction |
| 7. Backend otoritas | Sudah ada | Dipusatkan di `AuthorizationService` |
| 8. Permission ≠ fitur | Sebagian | Policy registry + drift report |

## 7. Kontradiksi & ketidaksesuaian

1. **README vs kode** — README menyebut `Admin/Editor/Penulis`, `article.*`, route `/admin`; tidak sesuai kode. README bukan acuan.
2. **Screenshot mentor vs kode** — "STRIPING-ERP", 4 role (finance 42, sales 82, logistic 51, superadmin 196), 196 permission, menu bertingkat, field `Nama/Username/Email/Phone/Role`. Sesuai klarifikasi, ini **target UI**, bukan existing. Field diadopsi: `Menu.{name,url,icon,parent,permission,description}`, `Role.{name,description,permissions,usersCount}`, `User.{name,username,email,phone,role}`. Route target `/menus`, `/permissions`, `/roles`, `/users`.
3. **Format key** — helper mentor `action:resource`, tabel mentor titik (`view.menu`), kode existing `resource.action`. **Keputusan (D1):** helper mentor eksplisit → pakai `action:resource`; key lama dipetakan (`article.read` → `read:article`, `user.manage` → `manage:user`). Data tabel dianggap contoh isian.
4. **Screenshot single-role** vs requirement #1 multi-role → requirement yang dipakai (penyimpangan sadar).
5. **Lokal lebih baru dari GitHub** — fitur Article hanya di working tree; wajib dipertahankan & diverifikasi.
6. **Password** — form mentor eksplisit "minimal 6 karakter", kode existing 8. **Keputusan (D5):** ikuti mentor (6); perubahan sadar pada `RegisterDto`.

## 8. Observasi keamanan existing

- Token di `localStorage` (XSS).
- Tidak ada rate limit login.
- `ValidationPipe` existing hanya `whitelist: true`. Target yang disepakati: **`ValidationPipe({ whitelist: true, transform: true })`**; `forbidNonWhitelisted` **tidak** diaktifkan agar perilaku existing (field asing dibuang, bukan error) tetap sama. Konfigurasi ini identik di dokumen 06 (API) dan 07 (security).
- Konstanta proteksi hardcoded & diduplikasi → risiko drift.
- Hapus `Permission` meng-cascade tanpa perlindungan.
- Tidak ada retensi/redaksi audit, belum ada username.

## 9. Hasil validasi audit

- ✅ Seluruh file relevan terbaca dari working tree lokal; remote tidak dipakai.
- ✅ 6 kontradiksi diidentifikasi dan diberi perlakuan eksplisit.
- ✅ D1 & D5 sesuai pilihan user dan berjustifikasi requirement mentor eksplisit.
- ✅ Tidak ada file yang diubah selama audit.
