# Phase 01 — Executive Summary

**Project:** PKL Auth System
**Phase:** 01 — Architecture & Database Design (documentation only)
**Date:** 2026-11-18 (final revision)
**Repository:** local working tree at repository root (`AriAja17/pkl-auth-system`)

## 1. Scope & basis

| Item | Keputusan |
|---|---|
| Source of truth | **Local working tree**. GitHub remote dianggap tertinggal dan sengaja diabaikan. |
| Fitur Article | Bagian dari baseline lokal (belum ter-commit). Harus dipertahankan, termasuk endpointnya. |
| Screenshot mentor | **Spesifikasi UI target**. Helper form "Tambah Permission" menuliskan format `action:resource` secara eksplisit, dan form "Tambah User" menuliskan "Password minimal 6 karakter" — keduanya dijadikan requirement. |
| Perubahan yang diizinkan | Hanya 7 dokumen di `docs/phase-01-architecture/`. |

Tidak ada source code, `prisma/schema.prisma` aktif, migrasi, dependency, atau Supabase yang diubah pada fase ini.

## 2. Ringkasan temuan

Sistem yang berjalan saat ini adalah RBAC **single-role** yang stabil: JWT `{ sub }`, bcrypt, `JwtAuthGuard` memuat ulang user + role + permission per request, `PermissionsGuard` memeriksa permission. Autentikasi ini dipertahankan mekanismenya, dengan **dua perubahan sadar sesuai requirement mentor**: password minimum 6 dan normalisasi permission key ke format `action:resource`.

Yang belum ada: multi-role, Menu, AuditLog, delegated administration, CRUD user oleh admin, paginasi, dan halaman admin per resource. Rencana target menambahkan **lima** tabel baru: `UserRole`, `Menu`, `MenuPermission`, `AdminCapability`, `AuditLog`.

## 3. Arsitektur target (sekilas)

- **Multi-role**: `UserRole(userId, roleId)`; permission user = union dari semua role. Default deny.
- **Role sistem**: `superadmin` (`isSystem = true`). Proteksinya dibedakan dalam tiga ranah: konfigurasi role, assignment user-role, manajemen permission (dokumen 05 §7.1).
- **Permission**: metadata murni dengan format **`action:resource`** (`view:menu`, `create:user`, `read:article`, `manage:user`). Membuat permission tidak membuat endpoint. Proteksi endpoint tetap dari `@RequirePermissions` di kode.
- **Menu**: tree `parentId`, many-to-many ke permission via `MenuPermission`; filter dilakukan backend.
- **Delegasi**: `AdminCapability` + 13 aturan anti-eskalasi, termasuk graf asiklik, invalidasi rantai, subset role, dan TTL 90 hari.
- **AuditLog**: transaksional, retention **365 hari**, **redaction whitelist**.
- **Migration**: additive → backfill → switch → cleanup. Tidak ada data yang hilang; pemetaan key lama → baru eksplisit dan terverifikasi; Article tetap berfungsi.

## 4. Keputusan yang dikunci

| # | Keputusan | Pilihan | Justifikasi & dampak |
|---|---|---|---|
| D1 | Format permission key | **`action:resource`** (titik dua) | Helper form mentor eksplisit. Key lama dipetakan: `article.read` → `read:article`, `user.manage` → `manage:user`. Seed, guard, konstanta, dan endpoint diubah di rilis yang sama; FK memakai `Permission.id`, sehingga assignment aman. |
| D2 | Nama role sistem | `superadmin` | Baris `Admin` di-update menjadi `superadmin` + `isSystem = true`. |
| D3 | Menu ↔ permission | many-to-many | `MenuPermission` dipertahankan; default **ANY-of**. |
| D4 | Username | wajib, unik, **case-insensitive**, maks. 30 karakter | Backfill deterministik dari email; `citext` + validasi aplikasi; register publik mengisi otomatis jika kosong. |
| D5 | Password minimum | **6 karakter** | Form "Tambah User" mentor eksplisit: "Password minimal 6 karakter". `RegisterDto` diubah dari 8 → 6 di rilis yang sama. |

Catatan: data tabel contoh mentor memakai titik (`view.menu`), sedangkan helper form memakai titik dua (`view:menu`). Sesuai pilihan kamu, **helper form yang dijadikan kanonik**; data tabel diperlakukan sebagai contoh isian, bukan spesifikasi format.

## 5. Open items (tidak dijadikan asumsi)

1. **O1** — Menu multi-permission: **ANY-of** sebagai default; perlu konfirmasi jika mentor menginginkan ALL-of.
2. **O2** — Kolom `roleId`: dihapus di M3 setelah verifikasi, atau disimpan sebagai arsip.
3. **O3** — Penyimpanan token (`localStorage` → cookie `httpOnly`): Phase 02 atau fase lanjutan.
4. **O4** — Daftar ~196 permission ERP mentor belum tersedia secara resmi; tidak di-seed otomatis.

Catatan: retensi `AuditLog` (**365 hari**) dan **redaction whitelist** sudah didefinisikan di dokumen 05 §9 dan 07 §5, sehingga **bukan** open item.

## 6. Peta dokumen

| Dokumen | Isi |
|---|---|
| `02-existing-system-audit.md` | Audit kode lokal, celah requirement, kontradiksi. |
| `03-target-database-design.md` | Model data target + ERD + pemetaan key. |
| `04-prisma-schema-proposal.prisma` | Draf schema Prisma 7. |
| `05-authorization-architecture.md` | Alur otorisasi, multi-role, delegasi, proteksi superadmin, audit. |
| `06-api-contract.md` | Kontrak REST dengan key `action:resource`. |
| `07-migration-security-and-testing.md` | Migrasi key, verifikasi preservasi, retensi/redaksi, risiko, test. |

## 7. Validation hasil Phase 01

- ✅ Remote git diverifikasi tetapi tidak dipakai sebagai acuan.
- ✅ Seluruh source relevan dibaca dari working tree lokal.
- ✅ Pilihan awal user dipertahankan: `action:resource` (D1) dan password 6 (D5), keduanya berjustifikasi requirement mentor eksplisit.
- ✅ Perbaikan revisi tetap dipertahankan: username deterministik/case-insensitive/30 char, superadmin 3 ranah, 13 aturan delegasi, retensi 365 hari + redaction, verifikasi preservasi.
- ✅ ERD ↔ Prisma ↔ API ↔ migrasi memakai format `action:resource` yang identik, termasuk mapping key lama.
- ✅ Hanya 7 dokumen yang dibuat/diubah; tidak ada kode, schema aktif, migrasi, dependency, atau Supabase yang disentuh.
- ⏹ Phase 01 berhenti di sini. **Phase 02 menunggu approval.**
