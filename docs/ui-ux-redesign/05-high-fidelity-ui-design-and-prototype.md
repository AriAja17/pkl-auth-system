# Phase 05 — High-Fidelity UI Design & Prototype

**Project:** PKL Auth System → Studio Management Platform
**Branch:** `design/studio-management-ui-ux`
**Date:** 2026-11-20
**Source of truth:** `01-ui-ux-audit.md`, `02-information-architecture-and-user-flows.md`, `03-design-system.md`, `04-wireframes-and-screen-design.md` (approved)
**Status:** **COMPLETED** (with documented validation limitations)

---

## 1. Ringkasan Hasil Desain

Phase 05 menerjemahkan wireframe Phase 04 menjadi high-fidelity visual design dan prototype interaktif mandiri. Seluruh pekerjaan terisolasi di:

- `docs/ui-ux-redesign/05-high-fidelity-ui-design-and-prototype.md` (dokumen ini)
- `docs/ui-ux-redesign/prototype/` (HTML, CSS, JavaScript biasa)

**Tidak ada** perubahan pada frontend aplikasi utama, backend, Prisma schema, database, dependency, atau dokumen Phase 01–04.

**Hasil utama:**

- 13 tampilan/screen-state desktop dan mobile sesuai Phase 04.
- Satu authenticated shell yang konsisten (topbar + sidebar + breadcrumb + main).
- Seluruh interaksi utama disimulasikan dengan mock data dan local state.
- Penanda eksplisit `PLANNED` untuk Projects, Project Detail, dan Team.
- Empat penyesuaian Phase 04 diterapkan: `--color-text-secondary`, error toast tidak auto-dismiss, peringatan penggantian permission Role, dan Save dinonaktifkan saat katalog gagal.

---

## 2. Inventaris Screen

| # | Screen | Status | File sumber prototype | Catatan |
|---|---|---|---|---|
| 1 | Login | EXISTING | `app.js` → `renderAuth()` | Simulasi login; validasi email + password ≥6 |
| 2 | Register | EXISTING | `app.js` → `renderRegister()` | Success panel, validasi username regex |
| 3 | Overview | EXISTING + restructure | `renderOverview()` | Recent Activity dari mock audit; My Projects **tidak dirender** |
| 4 | Projects List | PLANNED | `renderProjects()` | Label planned, data simulasi, search + status filter |
| 5 | Project Detail | PLANNED | `renderProjectDetail()` | Label planned, About + Members placeholder |
| 6 | Team | PLANNED | `renderTeam()` | Reuse data user; discipline placeholder |
| 7 | Users | EXISTING | `renderUsers()` | 3 aksi terlihat: Detail, Edit, More |
| 8 | Roles | EXISTING | `renderRoles()` | Warning replacement + catalog-failure guard |
| 9 | Permissions | EXISTING | `renderPermissions()` | Drift sample, protected badge, key validation |
| 10 | Menus | EXISTING | `renderMenus()` | Tree, parent exclusion, dynamic permission picker |
| 11 | Delegations | EXISTING | `renderDelegations()` | Backend rules dicerminkan pada picker |
| 12 | Activity / Audit | EXISTING | `renderActivity()` | Filter form + audit table |
| 13 | Activity Detail | EXISTING | `openDrawer()` dari `view-audit` | Right-side drawer desktop, full-screen mobile |

Activity Detail adalah **drawer**, bukan route terpisah, sesuai keputusan final Phase 04.

---

## 3. Visual Direction & Design Tokens

### 3.1 Arah visual

Modern Minimal SaaS Dashboard: surface putih di atas canvas `#F5F6F8`, border 1px, tanpa shadow berlebih, tipografi Geist dengan hierarki 24/18/16/14/12px, dan satu warna brand biru `#3357A8`. Tidak ada gradient, glassmorphism, neon, atau dekorasi gaming.

### 3.2 Token yang diterapkan [dari Phase 03]

| Kelompok | Token | Nilai / penggunaan |
|---|---|---|
| Brand | `--color-brand-primary` | `#3357A8` — tombol utama, link, active nav |
| Brand | `--color-brand-primary-subtle` | `#EEF2FB` — selected row/nav |
| Teks | `--color-text-primary` | `#1B2230` |
| Teks | `--color-text-secondary` | `#4A5568` — **token teks sekunder satu-satunya** (ADJ-01) |
| Teks | `--color-text-muted` | `#646D7D` |
| Surface | `--color-canvas` / `--color-surface` | `#F5F6F8` / `#FFFFFF` |
| Border | `--color-border-subtle` / `--color-border-strong` | `#E3E6EB` / `#838E9F` |
| Status | success/warning/danger/info | `#1F7A4D`, `#9A6200`, `#B32D33`, `#0F6E73` + surface tint |
| Focus | `--color-interactive-focus` | `#2F6FED`, outline 2px offset 2px |
| Spacing | `--space-1…--space-8` | 4/8/12/16/20/24/32px |
| Radius | `--radius-sm/md/lg` | 4/6/8px |
| Layout | sidebar / topbar / content | 240px / 56px / max 1280px |

### 3.3 Tipografi

- Font stack: `"Geist", ui-sans-serif, system-ui, …` dan `"Geist Mono", ui-monospace, …`.
- Prototype tidak mengunduh font atau menambah dependency; Geist dipakai bila tersedia di sistem, fallback tetap konsisten dan offline.
- Mono dipakai untuk ID, permission key, timestamps, dan blok before/after audit.

---

## 4. Komponen Utama

| Komponen | Implementasi prototype | Varian/state |
|---|---|---|
| Button | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger` | default, hover, active, disabled, loading (teks tetap) |
| Input/Select/Textarea | `.field` dengan `<label for>` | default, disabled, `aria-invalid`, inline error |
| Badge | `.badge-discipline`, `.badge-access`, `.badge-success/warning/danger/info` | discipline netral, access biru, status semantik |
| Alert | `.alert-info/warning/danger/success` | persisten untuk error/peringatan penting |
| Table | `.table-scroll > table` | header 40px, row 40px, hover, mono ID, pagination 32px |
| Drawer | `.drawer`, `.drawer-wide` | 480px / 720px ≥1280 / full-screen mobile; focus trap |
| Modal | `.modal-scrim > .modal` | 420px, konfirmasi destruktif, Escape/Batal |
| Toast | `.toast` + `#toast-root` | error **persisten** (ADJ-02); success/info 5s |
| Breadcrumb | `#breadcrumb` | root statis "Workspace", current diwarnai brand |
| Tree | `.tree-node`, `.tree-children` | indent guide 20px, tanpa inline margin hack |
| More menu | `<details class="more-menu">` | maks. 3 aksi terlihat pada tabel Users |

---

## 5. Interaction Behavior per Area

### 5.1 Authentication
- Login: validasi lokal, error `role="alert"` persisten, sukses → Overview + toast.
- Register: validasi email, username regex, password ≥6; success panel menggantikan form.

### 5.2 Shell
- Sidebar dari satu navigation registry; grup dengan nol item disembunyikan.
- Grup "Prototype concepts" hanya membantu reviewer membuka Team; bukan keputusan IA produk.
- Topbar: label **Workspace statis**, project context disabled/PLANNED, Profile menu berisi email, dynamic access-role badges, Logout.
- Kontrol prototype: simulasi katalog gagal dan pergantian actor (superadmin ↔ Editor).

### 5.3 Overview
- Recent Activity dari mock audit; "Lihat" membuka Activity Detail drawer.
- Quick Actions hanya "Kelola akses" dan "Lihat aktivitas", keduanya permission-gated.
- My Projects **tidak ditampilkan** sesuai koreksi final Phase 04.

### 5.4 Projects / Project Detail / Team (PLANNED)
- Banner `PLANNED` di setiap layar + data simulasi.
- Search/status filter bekerja pada mock data.
- Project Detail menampilkan About + Members placeholder; tab Team/Activity dinonaktifkan.
- Team menampilkan discipline placeholder dan access role dinamis; Add/Edit membuka drawer user.

### 5.5 Access Management
- **Users**: Detail (drawer read-only), Edit (drawer), More → Nonaktifkan/Aktifkan + Hapus. Baris akun sendiri menonaktifkan aksi dengan tooltip rekomendasi; backend tetap otoritatif.
- **Roles**: drawer dengan permission picker dikelompokkan per resource; alert permanen "Menyimpan akan mengganti seluruh permission"; protected Dinonaktifkan untuk actor non-system; Save disabled saat katalog gagal.
- **Permissions**: validasi `action:resource`, protected checkbox hanya untuk `isSystem`, drift sample.
- **Menus**: tree dengan indent guide; parent select mengecualikan diri sendiri + descendant; permission picker dinamis; Save disabled saat katalog gagal.
- **Delegations**: picker mengikuti aturan backend — `grant:admin` selalu disembunyikan, `create:delegation` hanya untuk `isSystem`, protected/permission/capability difilter untuk actor non-system; expiry min 1 menit, max 90 hari; revoke via confirmation modal.

### 5.6 Activity
- Filter form (action, resource type, actor, resource ID, from, to) + Reset.
- "Lihat" membuka drawer detail dengan before/after mono; filter dan tabel tetap terpasang di belakang scrim.

### 5.7 Feedback
- Toast sukses/info auto-dismiss 5 detik.
- Error toast uses manual dismissal and remains visible until the user closes it. This is the current approved prototype behavior.
- Setiap toast memiliki timer dan tombol tutupnya sendiri; menutup satu toast tidak memengaruhi toast lain.
- Error toast memakai `role="alert"`, sukses/info `role="status"`.
- Confirmation modal untuk delete/revoke dengan label spesifik ("Ya, hapus", "Ya, cabut").

---

## 6. Responsive Behavior

| Screen group | Desktop 1440 | Tablet 768 | Mobile 390 |
|---|---|---|---|
| Shell | sidebar 240px | sidebar overlay, toggle aktif | overlay 280px |
| Auth | card 400px | card 400px | full width −24px |
| Table | lebar penuh | `overflow-x:auto` | `overflow-x:auto`, filter wrap |
| Drawer | 480/720px | 480px | full-screen |
| Modal | 420px | 420px | 90vw |
| Before/after | 2 kolom | 1 kolom | 1 kolom |
| Activity detail | right drawer | right drawer | full-screen drawer |

**Hasil evaluasi DOM:** `document.documentElement.scrollWidth === window.innerWidth` pada 1440, 768, dan 390 → tidak ada horizontal overflow yang tidak disengaja.

---

## 7. Accessibility Considerations

- Setiap input memiliki `<label for>`; placeholder bukan pengganti label.
- `:focus-visible` outline 2px `#2F6FED` dengan offset 2px.
- Error menggunakan `role="alert"`, sukses/info `role="status"`.
- Drawer/modal: `role="dialog"/"alertdialog"`, `aria-modal`, focus trap, Escape close, focus kembali ke trigger.
- Status tidak hanya warna: selalu ada teks ("Aktif", "valid", "PLANNED") + badge.
- Kontras mengikuti tabel verifikasi Phase 03 (semua pasangan teks kritis lolos AA).
- `prefers-reduced-motion` menonaktifkan animasi drawer/scrim.
- Belum diuji dengan screen reader sungguhan — lihat keterbatasan.

---

## 8. Existing vs Planned

| Existing (dapat dipakai) | Planned (konsep, berlabel) | Postponed (tidak dibuat) |
|---|---|---|
| Login/Register, Overview, Users, Roles, Permissions, Menus, Delegations, Activity | Projects List, Project Detail, Team | Assets, Tasks, Settings, project-level auth, multi-studio |

Role `superadmin`, `Editor`, `Penulis` adalah contoh seed; prototype juga menyertakan `QA Lead` untuk membuktikan role dirender dinamis dari API. Sistem role didasarkan pada `isSystem`, bukan perbandingan nama.

---

## 9. Keputusan yang Masih Membutuhkan Persetujuan

1. Nama akhir access role (tetap seed names atau Administrator/Editor/Viewer) — UI sudah dinamis, aman untuk keduanya.
2. Nilai/status Project dan permission untuk membuat Project.
3. Apakah field Discipline benar-benar masuk MVP atau tetap placeholder.
4. Apakah group "Prototype concepts" perlu disimpan saat handoff ke implementasi (direkomendasikan: **tidak**).
5. Validasi akhir kontras dengan alat audit aksesibilitas otomatis/screen reader.

---

## 10. Checklist Final Design Handoff

- [x] Seluruh screen Phase 04 dibuat di prototype.
- [x] Existing vs Planned diberi penanda jelas.
- [x] Design tokens Phase 03 dipakai konsisten.
- [x] Empat penyesuaian Phase 04 diterapkan.
- [x] Navigasi, search/filter, drawer, modal, toast, dan validasi berfungsi.
- [x] Responsive 1440/768/390 tanpa horizontal overflow.
- [x] `node --check app.js` lulus.
- [x] Console browser kosong saat alur utama dijalankan.
- [x] Source code aplikasi utama tidak diubah.
- [ ] Screenshot visual arsip tidak berhasil diambil karena browser relay terputus (lihat laporan akhir).
- [ ] Screen reader / automated a11y audit belum dijalankan.

### 10.1 Hasil final verification (targeted QA)

- **ADJ-04 — PASS (runtime):** pada simulasi katalog gagal, tombol Simpan di drawer Roles, Menus, dan Delegations terbukti `disabled`; peringatan penggantian permission Role tetap tampil; setelah katalog pulih, tombol Simpan Roles kembali aktif. Handler submit juga memiliki guard untuk ketiga area.
- **Keyboard drawer — PASS (runtime):** fokus awal masuk ke drawer, Tab/Shift+Tab tetap di dalam, Escape menutup drawer, fokus kembali ke trigger, dan daftar user tidak berubah.
- **Keyboard modal — PASS (runtime):** fokus awal masuk ke modal, Tab/Shift+Tab tetap di dalam, Escape menutup modal tanpa menjalankan aksi destruktif, fokus kembali ke trigger, jumlah baris tidak berubah.
- **Nested modal/drawer — IMPLEMENTED, NOT RUNTIME VERIFIED:** prototype tidak memiliki alur yang membuka modal di atas drawer; focus stack sudah disiapkan, tetapi skenario tidak dapat diuji.
- **Toast — IMPLEMENTED, RUNTIME NOT VERIFIED:** kode memastikan error toast persisten dengan `role="alert"`, sukses/info auto-dismiss 5 detik, timer per toast, dan dismiss per toast. Uji waktu 6 detik di browser terputus karena browser relay terlepas berulang kali.

---

## 11. Cara Membuka Prototype

Buka `docs/ui-ux-redesign/prototype/index.html` langsung di browser lokal, atau sajikan folder tersebut dengan static server sederhana. Tidak ada backend, API, database, instalasi package, atau koneksi jaringan yang diperlukan.

**Penanda dokumen:** banner hitam di bagian atas setiap halaman menuliskan `DESIGN PROTOTYPE` dan penjelasan bahwa data adalah simulasi.

---

**STOP — Phase 05 selesai. Awaiting review.**
