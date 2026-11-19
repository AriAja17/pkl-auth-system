# PKL Auth System
## Sistem Authentication & Authorization Berbasis Role dan Permission Dinamis

PKL Auth System adalah aplikasi web untuk autentikasi dan pengelolaan hak akses pengguna menggunakan konsep **Role-Based Access Control (RBAC)**.

Sistem ini terdiri dari dua bagian utama:

- **Frontend:** Antarmuka web untuk registrasi, login, dashboard, dan pengelolaan user serta role.
- **Backend:** REST API yang menangani autentikasi, validasi token, pengelolaan role, permission, dan akses database.

Pengguna yang mendaftar mendapatkan akun tanpa role. Admin kemudian dapat memberikan role dan mengatur permission setiap role melalui sistem. Perubahan hak akses disimpan di database dan langsung berlaku tanpa pengguna harus login ulang.

## Fitur Utama

### Authentication
- Registrasi akun baru (username dibuat otomatis jika tidak diisi).
- Login menggunakan email dan password dengan hash bcrypt.
- Akun nonaktif tidak bisa login; pesan error sengaja dibuat generik.
- JWT berisi hanya `sub` dan berlaku satu hari.
- `GET /auth/me` mengembalikan data user, role, permission, dan menu yang terlihat.
- `POST /auth/login` dibatasi 10 request per IP per 15 menit (dapat dikonfigurasi).

### Authorization
- RBAC dinamis dengan **multi-role** (tabel `UserRole`).
- Permission berformat `action:resource`, disimpan di database.
- Guard membaca role/permission dari database setiap request, sehingga perubahan langsung berlaku tanpa login ulang.
- Default deny: endpoint tanpa permission ditolak.
- Role sistem `superadmin` tidak bisa diubah, dihapus, atau diberikan lewat API.
- Permission protected hanya bisa diberikan oleh `superadmin`.
- Admin tidak boleh mengubah akun sendiri atau mengubah permission role yang ia pegang.

### User Management
- Melihat, membuat, mengubah, dan menghapus pengguna.
- Memberikan/mencabut beberapa role sekaligus (`roleIds[]`).
- Endpoint legacy single-role (`roleId`) tetap tersedia untuk kompatibilitas.

### Role & Permission
- CRUD role dan permission, termasuk `isProtected`.
- Membuat permission otomatis menambahkannya ke role `superadmin` dalam satu transaksi.
- Laporan `drift` antara permission di database dan policy registry endpoint.

### Menu Dinamis
- Menu berbentuk tree dengan relasi `parentId`.
- Backend menyaring menu berdasarkan permission (ANY-of).
- Menu tanpa permission mapping dan submenu dari parent yang tersembunyi ikut disembunyikan.
- Visibilitas menu hanya petunjuk UI, bukan pengganti proteksi endpoint.

### Delegasi & Audit
- Delegasi capability dengan batas TTL maksimal 90 hari, anti-siklus, dan lineage parent-child.
- Role turunan wajib memakai permission yang sama dengan capability sumber.
- Audit Log mencatat aksi admin dengan `before`/`after` yang diredaksi.
- Retention Audit Log dijalankan scheduler harian pukul 02:00 WIB (default 365 hari).

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend Framework | Next.js 16 (App Router) |
| Frontend Language | TypeScript |
| Styling | Tailwind CSS |
| Backend Framework | NestJS |
| Backend Language | TypeScript |
| ORM | Prisma 7 |
| Database | PostgreSQL (Supabase) |
| Authentication | JWT |
| Password Hashing | bcryptjs |
| Validation | class-validator, class-transformer |

## Struktur Repository

```text
pkl-auth-system/
│
├── auth-backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   │
│   ├── src/
│   │   ├── admin/          # User, role, permission, menu, delegasi, audit (controller)
│   │   ├── articles/       # Endpoint contoh untuk permission
│   │   ├── audit/          # AuditService, redaction, retention scheduler
│   │   ├── auth/           # Register, login, JWT, guards, rate limit login
│   │   ├── authorization/  # Principal, policy registry, aturan akses
│   │   ├── common/         # DTO dan validasi bersama
│   │   ├── delegation/     # Siklus hidup capability & lineage
│   │   ├── menu/           # Tree menu dan validasi siklus
│   │   ├── prisma/         # Prisma service dan module
│   │   ├── generated/      # Prisma Client hasil generate
│   │   ├── main.ts
│   │   └── app.module.ts
│   │
│   ├── .env.example
│   └── package.json
│
├── auth-frontend/
│   ├── app/
│   │   ├── admin/          # users, roles, permissions, menus, delegations, audit-logs
│   │   ├── articles/       # Contoh halaman terproteksi
│   │   ├── dashboard/      # Dashboard pengguna
│   │   ├── login/          # Halaman login
│   │   ├── register/       # Halaman registrasi
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── lib/
│   │   ├── api.ts          # Komunikasi dengan backend dan token
│   │   ├── api-types.ts    # Tipe respons backend
│   │   └── auth-context.tsx # Sesi, canonicalPermissions, dan helper has()
│   │
│   └── package.json
│
├── .gitignore
└── README.md
```

## Prasyarat

Pastikan perangkat sudah memiliki:

- Node.js 24 atau lebih baru.
- npm.
- Git.
- Database PostgreSQL (proyek ini menggunakan Supabase).

## Instalasi dan Konfigurasi

### 1. Clone Repository

```bash
git clone https://github.com/AriAja17/pkl-auth-system.git
cd pkl-auth-system
```

### 2. Konfigurasi Backend

Masuk ke folder backend:

```bash
cd auth-backend
npm install
```

Buat file `.env` berdasarkan template:

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**

```bash
cp .env.example .env
```

Isi konfigurasi `.env`:

```env
DATABASE_URL="postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres"
JWT_SECRET="isi-dengan-string-acak-yang-panjang"
ADMIN_EMAIL="admin@contoh.com"
ADMIN_PASSWORD="ganti-dengan-password-kuat"
PORT=4000
AUDIT_RETENTION_DAYS=365
AUTH_LOGIN_RATE_LIMIT=10
AUTH_LOGIN_RATE_TTL_MS=900000
```

| Variabel | Fungsi |
|---|---|
| `DATABASE_URL` | Connection string database PostgreSQL |
| `JWT_SECRET` | Kunci rahasia untuk menandatangani JWT |
| `ADMIN_EMAIL` | Email akun superadmin pertama (dipakai seed) |
| `ADMIN_PASSWORD` | Password akun superadmin pertama (dipakai seed) |
| `PORT` | Port server backend, default 4000 |
| `AUDIT_RETENTION_DAYS` | Umur Audit Log sebelum dihapus scheduler, default 365 (integer positif) |
| `AUTH_LOGIN_RATE_LIMIT` | Maksimal request login per IP, default 10 (integer positif) |
| `AUTH_LOGIN_RATE_TTL_MS` | Jendela rate limit login dalam milidetik, default 900000 = 15 menit (integer positif) |

Nilai invalid untuk variabel bertipe integer positif membuat aplikasi gagal saat startup dengan pesan yang menyebut nama variabel. Frontend memakai `NEXT_PUBLIC_API_URL` di `auth-frontend/.env.local` (lihat langkah 6).

Untuk membuat JWT secret acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Siapkan Database

Pastikan konfigurasi database sudah benar, kemudian jalankan:

```bash
npx prisma generate
npx prisma migrate deploy
```

Keterangan:

- `prisma generate` membuat Prisma Client.
- `prisma migrate deploy` menerapkan migrasi database yang tersedia.

### 4. Isi Data Awal (Seed)

```bash
npx tsx prisma/seed.ts
```

Seed membuat 26 permission kanonik, tiga role (`superadmin`, `Editor`, `Penulis`), dan akun superadmin pertama dari `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Role `superadmin` mendapat seluruh permission dan tidak bisa diubah lewat API. Perintah ini memakai `upsert` sehingga aman dijalankan ulang, tetapi tetap merupakan operasi tulis ke database.

### 5. Jalankan Backend

Untuk development:

```bash
npm run start:dev
```

Backend berjalan di:

```text
http://localhost:4000
```

Pastikan server berhasil berjalan sebelum melanjutkan ke frontend.

### 6. Konfigurasi Frontend

Buka terminal baru, kemudian masuk ke folder frontend dari root repository:

```bash
cd auth-frontend
npm install
```

Buat file `.env.local` di dalam folder `auth-frontend`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

`NEXT_PUBLIC_API_URL` harus sesuai dengan alamat dan port backend.

### 7. Jalankan Frontend

```bash
npm run dev
```

Frontend berjalan di:

```text
http://localhost:3000
```

Aplikasi akan mengarahkan pengguna ke halaman login.

### 8. Menjalankan Testing

Backend (dari folder `auth-backend`):

```bash
npm test -- --runInBand
npx tsc --noEmit -p tsconfig.json
npm run build
npm run lint
```

Frontend (dari folder `auth-frontend`):

```bash
npm run lint
npm run build
```

Hasil terakhir yang benar-benar dijalankan: backend 122/122 unit test lulus, AdminService 29/29, TypeScript dan build backend lulus, frontend lint dan build produksi lulus. `npm run lint` backend **belum bersih** karena masih ada temuan lama di `src/main.ts` (`no-floating-promises`) dan beberapa warning `unbound-method` di spec lama. Test e2e dan integrasi runtime dengan Supabase belum dijalankan.

Catatan F-03: test rate limiting pernah mengalami timeout ketika dijalankan bersamaan dengan proses build berat; test yang sama lulus ketika suite backend dijalankan terpisah. Gangguan ini bersifat flaky pada lingkungan bersama, bukan kegagalan logika rate limiting.

## Cara Menjalankan Aplikasi

Untuk menjalankan aplikasi secara lokal, diperlukan dua terminal:

**Terminal 1 - Backend**

```bash
cd auth-backend
npm run start:dev
```

**Terminal 2 - Frontend**

```bash
cd auth-frontend
npm run dev
```

Buka `http://localhost:3000` melalui browser.

## Halaman Aplikasi

| Route | Fungsi |
|---|---|
| `/` | Dialihkan otomatis ke `/login` |
| `/register` | Registrasi akun baru tanpa role |
| `/login` | Login pengguna |
| `/dashboard` | Email, role, permission kanonik, dan tautan sesuai akses |
| `/articles` | Contoh halaman yang butuh `read:article` |
| `/admin` | Ringkasan panel administrasi |
| `/admin/users` | Kelola user dan assignment role |
| `/admin/roles` | Kelola role dan permission role |
| `/admin/permissions` | Kelola permission dan melihat drift |
| `/admin/menus` | Kelola tree menu dan permission menu |
| `/admin/delegations` | Lihat dan cabut delegasi capability |
| `/admin/audit-logs` | Lihat Audit Log dengan filter |

Panel admin hanya menampilkan tautan sesuai permission kanonik (`read:user`, `read:role`, `read:permission`, `read:menu`, `read:delegation`, `read:audit`). Proteksi tetap dilakukan backend; penyembunyian UI bukan mekanisme keamanan.

## Alur Penggunaan

1. Pengguna membuat akun melalui halaman registrasi; akun baru belum memiliki role.
2. Superadmin (dibuat saat seed) login dan membuka panel administrasi.
3. Superadmin membuat role, mengatur permission role, lalu memberikannya kepada pengguna (bisa beberapa role).
4. Perubahan role/permission langsung berlaku di backend pada request berikutnya tanpa login ulang; tampilan frontend perlu memuat ulang `/auth/me` untuk memperbarui data yang ditampilkan.
5. Pengguna login dan melihat dashboard sesuai permission yang dimiliki.
6. Aktivitas admin tercatat di Audit Log; menu yang ditampilkan disaring backend berdasarkan permission.

## Daftar API Endpoint

Semua endpoint berikut menggunakan base URL:

```text
http://localhost:4000
```

### Authentication

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/auth/register` | Publik | Registrasi akun |
| POST | `/auth/login` | Publik | Login dan mendapatkan JWT |
| GET | `/auth/me` | Token | Mendapatkan informasi pengguna |

> **Rate limit login:** `POST /auth/login` dibatasi 10 request per IP per 15 menit
> (`AUTH_LOGIN_RATE_LIMIT` dan `AUTH_LOGIN_RATE_TTL_MS` di `.env`). Guard hanya
> dipasang pada endpoint login; endpoint lain tidak terkena. Identitas klien
> diambil dari `req.ip` Express — `X-Forwarded-For` tidak dipercaya karena
> `trust proxy` tidak diaktifkan. Penyimpanan throttler bersifat **in-memory per
> process**, sehingga pada beberapa instance batasnya tidak global; diperlukan
> storage bersama jika batas lintas-instance diinginkan.

### Articles

| Method | Endpoint | Permission | Fungsi |
|---|---|---|---|
| GET | `/articles` | `read:article` | Melihat artikel |
| POST | `/articles` | `create:article` | Membuat artikel |
| PUT | `/articles/:id` | `update:article` | Mengedit artikel |
| DELETE | `/articles/:id` | `delete:article` | Menghapus artikel |

### User Management

| Method | Endpoint | Permission | Fungsi |
|---|---|---|---|
| GET | `/admin/users` | `read:user` | Daftar pengguna (`page`, `limit`, `search`) |
| POST | `/admin/users` | `create:user` | Buat `{ email, password, username?, name?, phone?, roleIds?[] }` |
| GET | `/admin/users/:id` | `read:user` | Detail user |
| PATCH | `/admin/users/:id` | `update:user` | Ubah `name`, `phone`, `isActive` |
| DELETE | `/admin/users/:id` | `delete:user` | Hapus user |
| PUT | `/admin/users/:id/roles` | `update:user` | Ganti seluruh role (`roleIds[]`) |
| POST | `/admin/users/:id/roles/:roleId` | `update:user` | Tambah satu role |
| DELETE | `/admin/users/:id/roles/:roleId` | `update:user` | Cabut satu role |
| PUT | `/admin/users/:id/role` | `manage:user` | *Legacy* — tetapkan satu `roleId` |
| DELETE | `/admin/users/:id/role` | `manage:user` | *Legacy* — cabut role tunggal |

### Role & Permission

| Method | Endpoint | Permission | Fungsi |
|---|---|---|---|
| GET | `/admin/roles` | `read:role` | Daftar role |
| POST | `/admin/roles` | `create:role` | Buat role dengan `permissionKeys[]` opsional |
| GET | `/admin/roles/:id` | `read:role` | Detail role |
| PATCH | `/admin/roles/:id` | `update:role` | Ubah nama/deskripsi role |
| DELETE | `/admin/roles/:id` | `delete:role` | Hapus role yang tidak dipakai |
| PUT | `/admin/roles/:id/permissions` | `update:role` | Ganti **seluruh** permission role |
| GET | `/admin/permissions` | `read:permission` | Daftar permission |
| POST | `/admin/permissions` | `create:permission` | Buat `{ key, description?, isProtected? }` (+ otomatis ke `superadmin`) |
| GET | `/admin/permissions/drift` | `read:permission` | Laporan permission vs policy registry |
| GET | `/admin/permissions/:id` | `read:permission` | Detail permission |
| PATCH | `/admin/permissions/:id` | `update:permission` | Ubah `description`/`isProtected` |
| DELETE | `/admin/permissions/:id` | `delete:permission` | Hapus permission yang tidak dipakai |

`PUT /admin/roles/:id/permissions` mengganti seluruh permission role, bukan menambahkan. Jika `permissionKeys` dikirim, field itu dipakai (prioritas atas alias lama `permissions`); jika keduanya tidak dikirim atau array kosong, seluruh permission role dihapus.

### Menu

| Method | Endpoint | Permission | Fungsi |
|---|---|---|---|
| GET | `/admin/menus` | `read:menu` | Tree menu pengelolaan (bukan pagination) |
| POST | `/admin/menus` | `create:menu` | Buat menu dengan `permissionIds[]` opsional |
| GET | `/admin/menus/:id` | `read:menu` | Detail menu |
| PATCH | `/admin/menus/:id` | `update:menu` | Ubah menu, termasuk parent & permission |
| DELETE | `/admin/menus/:id` | `delete:menu` | Hapus menu |
| PUT | `/admin/menus/:id/permissions` | `update:menu` | Ganti permission menu (`permissionIds[]` wajib) |

### Delegasi & Audit

| Method | Endpoint | Permission | Fungsi |
|---|---|---|---|
| GET | `/admin/delegations` | `read:delegation` | Daftar capability (`?granteeId`) |
| POST | `/admin/delegations` | `create:delegation` | Delegasi dengan `permissionKeys[]` & `expiresAt` |
| DELETE | `/admin/delegations/:id` | `delete:delegation` | Cabut capability beserta descendant-nya |
| GET | `/admin/audit-logs` | `read:audit` | Audit Log dengan filter actor/action/resource/waktu |

Semua daftar admin lain menggunakan `page`/`limit` (maks. 100); `/admin/menus` mengembalikan tree utuh. Respons delegasi memakai field `granteeId` dan `grantedBy`. Endpoint legacy dipertahankan untuk kompatibilitas klien lama.

Endpoint yang dilindungi memerlukan header:

```http
Authorization: Bearer <accessToken>
```

## Data Awal

### Permission

Seed membuat 26 permission kanonik: 5 hasil pemetaan key lama (`article.read`→`read:article`, dst., `user.manage`→`manage:user`) ditambah 21 permission baru untuk user, role, permission, menu, delegasi, audit, dan `grant:admin`. Permission `manage:user` dan `grant:admin` ditandai protected.

### Role

| Role | Permission |
|---|---|
| `superadmin` | Semua permission; `isSystem = true`, tidak bisa diubah lewat API |
| `Editor` | `read:article`, `update:article` |
| `Penulis` | `read:article`, `create:article` |

Akun superadmin pertama dibuat dari `ADMIN_EMAIL` dan `ADMIN_PASSWORD` lalu diberi role `superadmin`. Role dan permission lain dapat dibuat melalui panel admin atau API.

## Keamanan

- Password di-hash bcrypt (salt 10) dan tidak pernah dikirim dalam respons API.
- JWT hanya menyimpan `sub` (ID pengguna), berlaku satu hari, dan disimpan frontend di `localStorage` (risiko XSS; cookie `httpOnly` belum diimplementasikan).
- Role dan permission dibaca dari database setiap request; `JwtAuthGuard` memuat Principal dan `PermissionsGuard` mengecek permission kanonik.
- Validasi `ValidationPipe({ whitelist: true, transform: true })`; field asing dibuang, bukan error.
- CORS dibatasi ke `http://localhost:3000` di `src/main.ts`.
- Admin tidak dapat mengubah akunnya sendiri, menghapus akunnya sendiri, atau mengubah permission role yang ia pegang.
- Role `superadmin` tidak dapat diubah, dihapus, diberikan, atau dicabut melalui API.
- Permission protected (`manage:user`, `grant:admin`) hanya dapat diberikan `superadmin`.
- Role yang masih dipakai user tidak bisa dihapus; email dan username duplikat ditolak dengan 409.
- Akun nonaktif ditolak saat login dengan pesan yang sama seperti password salah.
- Login dibatasi per IP (default 10/15 menit) menggunakan storage **in-memory per process**; tidak melindungi antar-instance.
- Delegasi memakai TTL maksimal 90 hari, anti-siklus, dan lineage permission yang sama antara parent-child.
- Audit Log mencatat aktivitas admin dengan redaction whitelist; retention dijalankan scheduler harian 02:00 WIB sesuai `AUDIT_RETENTION_DAYS`.
- Visibilitas menu di `/auth/me` bukan proteksi; endpoint tetap diamankan oleh guard.

**Catatan:** Frontend hanya menampilkan hasil keputusan backend. Keputusan otorisasi sepenuhnya dilakukan di backend; menyembunyikan tombol atau menu di frontend bukan mekanisme keamanan.

## Pemecahan Masalah

| Gejala | Penyebab dan Solusi |
|---|---|
| Tidak bisa terhubung ke server | Pastikan backend berjalan dan `NEXT_PUBLIC_API_URL` benar |
| Cross-Origin Request Blocked | Periksa konfigurasi CORS di `auth-backend/src/main.ts` |
| Environment variable not found: `DATABASE_URL` | Pastikan file `.env` berada di folder `auth-backend` |
| Error `AUDIT_RETENTION_DAYS`/`AUTH_LOGIN_RATE_*` harus integer positif | Perbaiki nilai di `.env` lalu restart backend |
| `Cannot find module '../generated/prisma/client'` | Jalankan `npx prisma generate` dari folder backend |
| P1001 atau P1008 | Periksa koneksi database dan status Supabase |
| 403 pada endpoint admin | Permission kanonik kurang (mis. `read:user`, bukan `user.manage`) |
| 401 pada endpoint setelah login | Token kedaluwarsa/user nonaktif; login ulang dengan akun aktif |
| 429 pada `/auth/login` | Batas rate limit tercapai; tunggu hingga jendela TTL berakhir |
| Menu tidak muncul di sidebar | Menu tanpa permission mapping sengaja disembunyikan; beri permission pada menu |
| Port sudah digunakan | Ubah `PORT` backend dan sesuaikan `NEXT_PUBLIC_API_URL` frontend |

## Pengembangan Selanjutnya

Beberapa pengembangan yang direncanakan atau masih menjadi keterbatasan:

- Penyimpanan token di cookie `httpOnly` menggantikan `localStorage`.
- Refresh token dan logout sisi server.
- Storage rate limit bersama (mis. Redis) agar batas berlaku lintas instance.
- Koordinasi scheduler retention agar hanya satu instance yang membersihkan Audit Log.
- Cleanup proaktif capability delegasi yang kedaluwarsa (saat ini fail-closed dan diganti saat re-grant).
- Pagination nyata untuk tree menu `/admin/menus`.
- Daftar ~196 permission ERP mentor belum tersedia secara resmi (O4).
- E2E dan verifikasi integrasi runtime dengan Supabase masih perlu dilakukan.

---

**Project:** PKL Auth System  
**Repository:** [AriAja17/pkl-auth-system](https://github.com/AriAja17/pkl-auth-system)
