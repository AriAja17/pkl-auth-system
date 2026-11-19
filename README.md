# PKL Auth System
## Sistem Authentication & Authorization Berbasis Role dan Permission Dinamis

PKL Auth System adalah aplikasi web untuk autentikasi dan pengelolaan hak akses pengguna menggunakan konsep **Role-Based Access Control (RBAC)**.

Sistem ini terdiri dari dua bagian utama:

- **Frontend:** Antarmuka web untuk registrasi, login, dashboard, dan pengelolaan user serta role.
- **Backend:** REST API yang menangani autentikasi, validasi token, pengelolaan role, permission, dan akses database.

Pengguna yang mendaftar mendapatkan akun tanpa role. Admin kemudian dapat memberikan role dan mengatur permission setiap role melalui sistem. Perubahan hak akses disimpan di database dan langsung berlaku tanpa pengguna harus login ulang.

## Fitur Utama

### Authentication
- Registrasi akun baru.
- Login menggunakan email dan password.
- Password di-hash menggunakan bcrypt.
- Autentikasi menggunakan JWT dengan masa berlaku satu hari.
- Endpoint untuk mendapatkan informasi pengguna yang sedang login.

### Authorization
- Sistem Role-Based Access Control (RBAC).
- Role dan permission tersimpan di database.
- Admin dapat membuat role baru.
- Admin dapat mengubah permission pada role.
- Admin dapat memberikan atau mencabut role pengguna.
- Perubahan role dan permission berlaku secara langsung.
- Endpoint dilindungi menggunakan JWT dan permission guard.

### User Management
- Melihat daftar pengguna.
- Melihat role dan permission.
- Memberikan atau mencabut role pengguna.
- Menghapus pengguna.
- Mengelola role dan permission melalui halaman admin.

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
│   │   ├── admin/          # Pengelolaan user, role, dan permission
│   │   ├── articles/       # Endpoint contoh untuk permission
│   │   ├── auth/           # Register, login, JWT, guards, dan DTO
│   │   ├── prisma/         # Prisma service dan module
│   │   ├── main.ts
│   │   └── app.module.ts
│   │
│   ├── .env.example
│   └── package.json
│
├── auth-frontend/
│   ├── app/
│   │   ├── admin/          # Halaman pengelolaan user dan role
│   │   ├── dashboard/      # Dashboard pengguna
│   │   ├── login/          # Halaman login
│   │   ├── register/       # Halaman registrasi
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── lib/
│   │   └── api.ts          # Komunikasi dengan backend dan token
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
```

| Variabel | Fungsi |
|---|---|
| `DATABASE_URL` | Connection string database PostgreSQL |
| `JWT_SECRET` | Kunci rahasia untuk menandatangani JWT |
| `ADMIN_EMAIL` | Email akun admin pertama |
| `ADMIN_PASSWORD` | Password akun admin pertama |
| `PORT` | Port server backend, default 4000 |

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

Seed membuat permission, tiga role contoh, dan akun admin pertama berdasarkan `ADMIN_EMAIL` dan `ADMIN_PASSWORD`.

Perintah ini aman dijalankan berulang karena menggunakan `upsert`.

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
| `/dashboard` | Menampilkan email, role, dan permission |
| `/admin` | Mengelola pengguna, role, dan permission |

Halaman admin hanya dapat diakses oleh pengguna yang memiliki permission `user.manage`.

## Alur Penggunaan

1. Pengguna membuat akun melalui halaman registrasi.
2. Pengguna login menggunakan akun yang telah dibuat.
3. Dashboard menampilkan informasi akun tanpa role.
4. Admin login menggunakan akun admin yang dibuat melalui seed.
5. Admin memberikan role kepada pengguna melalui halaman admin.
6. Pengguna melakukan refresh dashboard untuk melihat role dan permission terbaru.

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
| GET | `/articles` | `article.read` | Melihat artikel |
| POST | `/articles` | `article.create` | Membuat artikel |
| PUT | `/articles/:id` | `article.update` | Mengedit artikel |
| DELETE | `/articles/:id` | `article.delete` | Menghapus artikel |

### Administration

| Method | Endpoint | Permission | Fungsi |
|---|---|---|---|
| GET | `/admin/users` | `user.manage` | Melihat daftar pengguna |
| GET | `/admin/roles` | `user.manage` | Melihat daftar role |
| GET | `/admin/permissions` | `user.manage` | Melihat daftar permission |
| POST | `/admin/roles` | `user.manage` | Membuat role baru |
| PUT | `/admin/roles/:id/permissions` | `user.manage` | Mengubah permission role |
| DELETE | `/admin/roles/:id` | `user.manage` | Menghapus role |
| PUT | `/admin/users/:id/role` | `user.manage` | Memberikan role |
| DELETE | `/admin/users/:id/role` | `user.manage` | Mencabut role |
| DELETE | `/admin/users/:id` | `user.manage` | Menghapus pengguna |

Endpoint yang dilindungi memerlukan header:

```http
Authorization: Bearer <accessToken>
```

## Data Awal

### Permission

| Permission | Keterangan |
|---|---|
| `article.read` | Melihat artikel |
| `article.create` | Membuat artikel |
| `article.update` | Mengedit artikel |
| `article.delete` | Menghapus artikel |
| `user.manage` | Mengelola pengguna dan role |

### Role

| Role | Permission |
|---|---|
| Admin | Semua permission |
| Editor | `article.read`, `article.update` |
| Penulis | `article.read`, `article.create` |

Akun admin pertama dibuat berdasarkan konfigurasi `ADMIN_EMAIL` dan `ADMIN_PASSWORD` di backend.

## Keamanan

- Password disimpan dalam bentuk hash menggunakan bcrypt.
- Password tidak pernah dikirim dalam respons API.
- JWT hanya menyimpan ID pengguna.
- Role dan permission dibaca dari database pada setiap request.
- `JwtAuthGuard` memeriksa autentikasi pengguna.
- `PermissionsGuard` memeriksa hak akses endpoint.
- Validasi menggunakan `whitelist: true`.
- CORS hanya mengizinkan frontend yang telah dikonfigurasi.
- Admin tidak dapat mengubah, mencabut role, atau menghapus akunnya sendiri.
- Role Admin tidak dapat diberikan, diubah, atau dihapus melalui API.
- Permission `user.manage` hanya boleh dimiliki role Admin.
- Role yang masih digunakan pengguna tidak dapat dihapus.

**Catatan:** Frontend hanya bertugas menampilkan antarmuka dan membantu pengalaman pengguna. Keputusan otorisasi tetap dilakukan oleh backend. Menyembunyikan tombol di frontend bukan mekanisme keamanan.

## Pemecahan Masalah

| Gejala | Penyebab dan Solusi |
|---|---|
| Tidak bisa terhubung ke server | Pastikan backend berjalan dan `NEXT_PUBLIC_API_URL` benar |
| Cross-Origin Request Blocked | Periksa konfigurasi CORS di `auth-backend/src/main.ts` |
| Environment variable not found: `DATABASE_URL` | Pastikan file `.env` berada di folder `auth-backend` |
| `Cannot find module '../generated/prisma/client'` | Jalankan `npx prisma generate` dari folder backend |
| P1001 atau P1008 | Periksa koneksi database dan status Supabase |
| Halaman admin mengalihkan ke dashboard | Pengguna tidak memiliki permission `user.manage` |
| Login gagal setelah akun dihapus | Login kembali menggunakan akun yang masih aktif |
| Port sudah digunakan | Ubah `PORT` backend dan sesuaikan `NEXT_PUBLIC_API_URL` frontend |

## Pengembangan Selanjutnya

Beberapa pengembangan yang direncanakan:

- Penggunaan cookie `httpOnly`.
- Implementasi refresh token dan logout sisi server.
- Soft delete untuk pengguna.
- Automated testing.
- Audit log perubahan role.
- Pagination pada daftar pengguna.

---

**Project:** PKL Auth System  
**Repository:** [AriAja17/pkl-auth-system](https://github.com/AriAja17/pkl-auth-system)
