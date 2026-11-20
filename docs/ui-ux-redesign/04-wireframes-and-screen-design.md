# Phase 04 — Wireframe & Screen Design

**Project:** PKL Auth System → Studio Management Platform
**Branch:** `design/studio-management-ui-ux`
**Date:** 2026-11-20
**Depends on:** `01-ui-ux-audit.md`, `02-information-architecture-and-user-flows.md`, `03-design-system.md` (all approved)
**Scope:** wireframes and screen specifications only. No application implementation, components, CSS, Tailwind config, API, schema, or dependency changes.

**Status labels used below**

- **[EXISTING]** — route/behavior already present in the repository.
- **[PLANNED]** — proposed in approved Phase 02; no implementation exists.
- **[PLACEHOLDER]** — visually shown only to reserve space; no data source exists.
- **[CONSTRAINT]** — must be preserved from earlier phases.

---

## 1. Executive Summary

This document translates the approved IA, flows, and design system into low-fidelity, implementation-ready screen layouts. It covers authentication, the global shell, Overview, Projects, Team, all five Access Management modules, and Activity / Audit.

**Key outputs**

- One authenticated shell for every signed-in screen (desktop + mobile).
- Auth screens using the shared form and state patterns.
- Overview that shows only data with a real source: identity, access roles, permissions, existing audit entries, and planned/placeholder project area.
- Projects list/detail explicitly marked **[PLANNED]**.
- Team directory that separates existing user data from future discipline/project-membership fields.
- Access Management screens preserving current backend behavior, including full permission replacement on role save and blocked saves when dependent catalogs fail.
- Activity / Audit reusing existing audit fields only.

**Proposed adjustments to the approved Design System (recorded, not applied) [RECOMMENDATION]**

| # | Adjustment | Reason |
|---|---|---|
| ADJ-01 | Use `--color-text-secondary` for all secondary text; treat `--color-brand-secondary` as a deprecated alias, not a second text token. | Phase 04 clarification; avoids duplicate semantics. |
| ADJ-02 | Error toasts must **not** auto-dismiss. Success/info toasts may auto-dismiss after 5s. | Phase 04 clarification; errors need time to be read and acted upon. |
| ADJ-03 | Show explicit "Save replaced all permissions" guidance in the Roles form drawer. | Backend `PUT /admin/roles/:id/permissions` replaces the whole assignment. |
| ADJ-04 | Disable Save in Roles/Menus/Delegations forms when the permission catalog is unavailable. | Phase 01 UX-18; prevents silent permission clearing. |

The Phase 03 document is not modified here. These adjustments must be accepted before Phase 05 implementation.

---

## 2. Design References and Constraints

### 2.1 Source documents [CONSTRAINT]

- Phase 01: existing routes, UX findings UX-01…UX-24.
- Phase 02: sitemap, navigation groups, flows 7.1…7.7, role distinction.
- Phase 03: tokens, components, spacing, elevation, accessibility, anti-patterns.

### 2.2 Applied measurements [CONSTRAINT]

| Element | Value |
|---|---|
| Sidebar expanded | 240px |
| Mobile overlay sidebar | 280px max |
| Topbar height | 56px |
| Breadcrumb height | 32px |
| Page padding desktop | 24px |
| Page padding mobile | 12px |
| Content max width | 1280px |
| Narrow content max width | 760px |
| Card padding | 16px / 20px |
| Section gap | 24px |
| Component gap | 8–12px |
| Control height | 36px standard, 32px compact |
| Table row height | 40px min |
| Drawer width | 480px / 720px ≥1280px |
| Modal width | 420px |
| Radius | 4px controls, 6px cards, 8px overlays |

### 2.3 Content rules [CONSTRAINT]

- Access roles are **dynamic** data from the existing API. `superadmin`, `Editor`, and `Penulis` are seeded examples, **not an exhaustive whitelist**. Badges and pickers render whatever `roles[]` the API returns.
- System-role behavior is determined by the **`isSystem` flag**, never by comparing role names. Backend authorization rules are preserved.
- Studio Discipline badges are neutral, Access Role badges blue-tinted, Status badges semantic.
- Project context is visual context only; it never implies authorization.
- No project-level audit context, no multi-studio selector, no asset/task/settings screens.
- UX-13 name resolution is a data/integration concern; wireframes use mono text for raw IDs as a fallback only.
- Light mode baseline; preserve WCAG AA contrast; respect reduced motion.

---

## 3. Global Shell Wireframes

### 3.1 Desktop shell [EXISTING structure, RESTRUCTURED]

**Screen purpose:** persistent frame for all signed-in screens.
**Primary user:** all authenticated users.
**Main task:** navigate workspace, understand context, access profile.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ TOPBAR  h=56  bg=surface border-bottom                                 │
│ [Workspace] [Project context* ▾]                      [Profile ▾]       │
│  static label    *PLANNED — hidden until Projects      right 24px       │
├────────────────┬─────────────────────────────────────────────────────────┤
│ SIDEBAR 240px  │ BREADCRUMB h=32  p=24  text=12 muted                  │
│ bg=surface     │ Studio / Access Management / Users                     │
│ border-right   ├─────────────────────────────────────────────────────────┤
│                │ MAIN  bg=canvas  p=24  gap=24  max-width=1280          │
│ Studio         │ ┌─────────────────────────────────────────────────────┐ │
│  Overview      │ │ Page title 24/600 + primary action (right)          │ │
│  Projects*     │ ├─────────────────────────────────────────────────────┤ │
│                │ │ Section blocks (cards/tables) gap=24               │ │
│                │ └─────────────────────────────────────────────────────┘ │
│                │                                                         │
│ Access & Act.  │                                                         │
│  Users         │                                                         │
│  Roles         │                                                         │
│  Permissions   │                                                         │
│  Delegation    │                                                         │
│  Menus         │                                                         │
│  Activity      │                                                         │
└────────────────┴─────────────────────────────────────────────────────────┘
  * PLANNED — show only after the actual page exists
```

**Shell decisions [RECOMMENDATION]:** the Topbar "Workspace" label is a **static generic label**, not a Studio/Workspace database entity or selector. The Project Context selector is **[PLANNED]** and hidden until `/projects` exists. Global Search is postponed and absent from MVP. No placeholder navigation link is rendered before its page exists. The Profile menu stays in the Topbar (name/email, dynamic access-role badges from the API, Logout). Account Settings is postponed; there is no Profile item in the sidebar.

**Component hierarchy:** Shell > Topbar (static workspace label, planned project context, profile menu) > Sidebar (navigation registry) > Breadcrumb > Main.

**Actions:** primary page action lives in Main, not Topbar. Topbar profile menu contains: name/email, Access Role badges rendered from `roles[]`, Logout **[EXISTING]**. Discipline is not shown until the field exists **[PLANNED]**.

**Visibility rules:** nav items filtered by `has(permission)` from approved Phase 02; an item also requires its page to exist. **Groups with zero visible items are hidden entirely.** In MVP the "Team & Work" group is absent because Team is unavailable and Assets/Tasks are postponed. Hidden nav is not authorization; backend guards remain authoritative. Postponed items are omitted, not shown disabled.

**States:** loading → skeleton in main only, shell stays; error → inline error in main; no session → redirect `/login`.

### 3.2 Mobile shell [EXISTING pattern, RESTRUCTURED]

```text
┌──────────────────────────────┐
│ h=56 [☰] [Page title] [▾]    │  topbar, 12px horizontal padding
│ h=32  Workspace / Users      │  static root label, truncated ellipsis
├──────────────────────────────┤
│ MAIN p=12 full width         │
│  title 24 → 20 on narrow     │
│  blocks stacked, gap=16      │
│  tables scroll-x             │
└──────────────────────────────┘

When ☰ tapped:
┌──────────────────────────┐
│ OVERLAY SIDEBAR 280px    │  scrim rgba(17,24,39,.48)
│ same groups as desktop   │  tap scrim or item closes
└──────────────────────────┘
```

**Interaction:** sidebar closed by default; focus moves into overlay, Escape closes, focus returns to ☰. Motion 160ms; disabled under reduced motion.

---

## 4. Authentication Screens

### 4.1 Login [EXISTING]

**Purpose:** authenticate and enter the studio workspace.
**Primary user:** all personnel.
**Main task:** sign in.
**Permission:** public.

**Desktop layout** — centered card on canvas:

```text
┌──────────────────────────────────────┐
│ canvas #F5F6F8 full viewport         │
│                                      │
│   ┌──────────────────────────────┐   │
│   │ card w=400 p=24 radius=6     │   │
│   │ "Studio Management" 24/600   │   │
│   │ "Masuk ke workspace" 12 mut  │   │
│   │                              │   │
│   │ Label: Email         12/600  │   │
│   │ [ input h=40 ]              │   │
│   │ gap=12                       │   │
│   │ Label: Password      12/600  │   │
│   │ [ input h=40 ]              │   │
│   │ gap=12                       │   │
│   │ [ error alert — persistent ]│   │
│   │ [ Login        ] primary    │   │
│   │ Belum punya akun? Daftar    │   │
│   └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

**Mobile:** same card, `width: calc(100% - 24px)`, margin 12px, padding 20px.

**Hierarchy:** product name → instruction → Email → Password → error → primary action → register link.

**Actions:** primary "Login"; secondary text link "Daftar".

**Interaction:** client validation on submit; on success store token, load `/auth/me`, redirect to `/dashboard`. Error message must stay visible until dismissed or corrected **[ADJ-02]**.

**States:** loading = button "Memproses..." + spinner, disabled; empty = no error; error = danger inline alert with generic message, including 429 rate-limit text; success = redirect.

### 4.2 Register [EXISTING]

**Purpose:** create an account with no access roles.
**Primary user:** new personnel.
**Main task:** register.
**Permission:** public.

**Desktop layout:** same 400px card; heading "Daftar"; helper 12px "Akun baru belum punya akses sampai admin memberi role"; fields Email, Username (opsional), Password (min. 6); primary "Daftar"; link "Sudah punya akun? Login".

**Mobile:** full-width card with stacked fields, gap 12.

**Hierarchy:** title → helper → fields → error → action → login link.

**Actions:** primary "Daftar"; secondary "Login".

**Interaction:** inline field validation (email format, username regex, password ≥6) **[UX-06/UX-07]**; success replaces form with confirmation panel and "Ke halaman login" link.

**States:** loading = disabled button; error = persistent inline error; success = confirmation panel; empty = no error.

---

## 5. Overview Dashboard

### 5.1 Overview [EXISTING page, PLANNED enrichment]

**Purpose:** orientation after login.
**Primary user:** all authenticated users.
**Main task:** see identity/context and jump to relevant areas.
**Flow:** Phase 02 §7.2.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ MAIN max1280 p24                                                     │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ "Selamat datang, {username}"        24/600                       │ │
│ │ "Workspace" (static label) + dynamic access role badges 12/muted  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│  gap 24                                                              │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Recent Activity [EXISTING data]      section title 18/600        │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ actor · action · time   —   from /admin/audit-logs           │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│  gap 24                                                              │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Quick actions: [Kelola akses] [Lihat aktivitas]                   │ │
│ │ rendered only when the destination exists AND permission allows   │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**Component hierarchy:** Overview > Welcome panel > Recent Activity panel > one Quick actions section.

**Actions:** only two contextual actions exist in MVP: "Kelola akses" (requires any access-management read permission and an existing destination) and "Lihat aktivitas" (requires `read:audit`). There is no separate page-level "Quick action" dropdown and no project action until Projects and its permission are defined.

**My Projects [FUTURE CONCEPT]:** **not rendered in MVP.** It stays as a Phase 02 wireframe concept only. No widget, placeholder list, fake empty state, or counts are shown until `/projects` and a real data source exist.

**Interaction:** Recent Activity uses existing audit data; rows open the Activity detail drawer (section 9).

**States:** loading = skeleton rows in Recent Activity; empty = "Belum ada aktivitas" with no CTA unless permitted; error = inline danger panel with Retry; success = content visible.

**Visibility:** identity/role info for authenticated user; activity only if `read:audit`; quick actions filtered by permission.

---

## 6. Projects Screens

**Status: fully [PLANNED]. No API, DB entity, or route exists.** All content below is placeholder/demo guidance for implementation, not a description of current behavior.

### 6.1 Projects list [PLANNED]

**Purpose:** find and open a project.
**Primary user:** Developer, Designer, QA, Administrator.
**Main task:** locate a project.
**Flow:** Phase 02 §7.3.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ MAIN max1280 p24                                                     │
│ "Projects" 24/600              [New project] — hidden until rule set │
│ subtitle: "Proyek studio yang terlihat oleh akun Anda." 12 muted    │
│ gap 16                                                              │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Filter row h=40: [ Cari proyek        ] [ Status ▾ ] [ Reset ]  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ gap 12                                                              │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ TABLE header h=40 bg=canvas 12/600                              │ │
│ │ PROJECT | STATUS | MEMBERS | UPDATED | ACTIONS                   │ │
│ │ row h=40, hover canvas, divider #ECEEF2                          │ │
│ │ name 14/500; status badge semantic; members mono 12; date muted │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ Pagination: 32px buttons, page numbers                              │
└──────────────────────────────────────────────────────────────────────┘
```

**States:** loading = 5 skeleton rows; empty = "Belum ada proyek" with no CTA; error = danger panel + Retry; success = table.

**Visibility:** project visibility rule is an open decision; do not imply that project membership grants authorization.

### 6.2 Project detail [PLANNED]

**Purpose:** project summary and entry point.
**Primary user:** assigned project members/Administrator.
**Main task:** understand project context.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Studio / Projects / {Project name}                       │
│ Header: {Project name} 24/600   [Status badge]   [Edit*]             │
│ subtitle: "Dibuat {date} · Diperbarui {date}" 12 muted              │
│ gap 24                                                              │
│ ┌───────────────────────────────────┬──────────────────────────────┐ │
│ │ About  section 18/600             │ Members [PLACEHOLDER]        │ │
│ │ description 14/body               │ name · discipline badge      │ │
│ │ key/value rows (12 labels)        │ (future field)               │ │
│ └───────────────────────────────────┴──────────────────────────────┘ │
│ gap 24                                                              │
│ Tabs: Overview (active) | Team† | Activity†   † POSTPONED           │
└──────────────────────────────────────────────────────────────────────┘
```

**States:** loading = header skeleton + 2 panel skeletons; empty = "Proyek belum punya deskripsi"; error = inline error; success = panels visible.

---

## 7. Team Management

### 7.1 Team directory [PLANNED, REUSES EXISTING USER DATA]

**Purpose:** see people and their roles.
**Primary user:** Administrator, leads.
**Main task:** find a member and understand access.
**Flow:** Phase 02 §7.4.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ "Team" 24/600            [Add member] — requires create:user        │
│ subtitle: "Anggota studio dan access role mereka." 12 muted         │
│ gap 16                                                              │
│ Filter row h=40: [Cari nama/email] [Discipline* ▾] [Access role ▾]   │
│ gap 12                                                              │
│ TABLE: MEMBER | DISCIPLINE* | ACCESS ROLES | STATUS | ACTIONS        │
│  member: avatar initials 24px + name 14 + email 12 muted            │
│  discipline badge NEUTRAL [FUTURE — show placeholder dash if absent]│
│  access role badge BLUE: dynamic {role.name} from API [EXISTING]    │
│  status badge SEMANTIC: Aktif / Nonaktif [EXISTING]                 │
│ Pagination 32px                                                     │
└──────────────────────────────────────────────────────────────────────┘
  * PLANNED field, no data source yet
```

**Actions:** Add member → drawer; Edit → drawer; "Kelola akses" → Access Management Users (if permitted).

**Interaction:** search uses existing `?search=` behavior from `/admin/users`; discipline filter is **[PLACEHOLDER]** and disabled until field exists.

**States:** loading/empty/error/success same as Access Users (section 8.1). **UX-13 note:** raw IDs from delegation are not solved here; use mono fallback text only.

**Visibility:** `read:user` to view; `create:user`, `update:user`, `delete:user` for actions. Discipline never affects nav visibility.

### 7.2 Add / edit member drawer [EXISTING fields + PLANNED field]

**Drawer 480px, 720px ≥1280:**

```text
┌────────────────────────────────┐
│ Header: Edit member      [×]   │
│ body p16 scroll, gap12         │
│ Email        [disabled on edit]│
│ Username     [disabled on edit]│
│ Nama         [ input ]         │
│ Telepon      [ input ]         │
│ Password     [ input new only ]│
│ Discipline*  [ — belum tersedia ]  placeholder disabled             │
│ Access roles [dynamic list from GET /admin/roles]                 │
│  ☑ {role.name}  [isSystem → read-only system badge]                 │
│  ☐ {role.name}                                                    │
│ footer: Batal | Simpan (primary)                                   │
└────────────────────────────────┘
```

**Behavior:** save calls existing user PATCH + roles PUT; multi-role replaces existing assignments. Role names are rendered from the API response; `superadmin`/`Editor`/`Penulis` are seeded examples only. System-role protection uses the `isSystem` flag, not a hardcoded name comparison. Do not imply project membership grants authorization.

---

## 8. Access Management

**Shared list-page wireframe [EXISTING]** used by Users, Roles, Permissions, Delegations (Menus uses tree variant):

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Title 24/600      [Primary action]  (only if create permission)      │
│ subtitle 12 muted                                                   │
│ gap 16                                                              │
│ Filter/search row h=40 + optional banner (drift / status)            │
│ gap 12                                                              │
│ TABLE header 40 | rows 40 | hover canvas | selected primary-subtle   │
│ ACTION column right: Detail · Edit · more (max 3 visible)            │
│ Pagination 32px with page numbers                                   │
│                                                                      │
│ Drawer 480/720 for create/edit; Modal 420 for confirm; Toast top-right│
└──────────────────────────────────────────────────────────────────────┘
```

### 8.1 Users [EXISTING]

**Purpose:** manage accounts and access roles.
**Primary user:** Administrator.
**Main task:** create/edit/deactivate user, assign roles.
**Permissions:** `read:user`, `create:user`, `update:user`, `delete:user`.

**Table columns:** User (username 14/500 + email 12 muted), Access roles (blue badges rendered dynamically from `roles[]`; seeded examples are `superadmin`/`Editor`/`Penulis`), Status (semantic badge Aktif/Nonaktif), Actions — **max 3 visible** per Phase 03: **Detail · Edit · More**. "More" contains Nonaktifkan/Aktifkan and Hapus, each still permission-gated.

**Drawer fields:** Email*, Username (opsional), Nama, Telepon, Password (create only), Access roles checkboxes, Aktif checkbox (edit). Email/Username disabled on edit (existing behavior).

**Detail panel:** same as drawer fields read-only + role badges.

**Filters:** search email/username; pagination 10 per page.

**States:** loading skeleton; empty "Belum ada user."; error persistent danger toast; success persistent-lite success toast (auto 5s allowed).

**Own-account restriction:** the backend enforces `assertNotSelf()` in `AdminService.updateUser()` / `deleteUser()` **[VERIFIED: `auth-backend/src/admin/admin.service.ts:326-331`]**, but the current frontend renders row actions only from `has('update:user')` / `has('delete:user')` and has **no own-account check** **[VERIFIED: `auth-frontend/app/admin/users/page.tsx:427-453`]**. Therefore hiding/disabling Edit, status toggle, and Delete on the actor's own row, with tooltip "Tidak dapat mengubah akun sendiri", is a **[RECOMMENDATION]** — not an existing UI behavior. The backend remains authoritative. Role save replaces all role assignments.

### 8.2 Roles [EXISTING]

**Purpose:** manage roles and their permissions.
**Permissions:** `read:role`, `create:role`, `update:role`, `delete:role`.

**Table columns:** Role (name + system note derived from `role.isSystem`, not from a name string), Users count (mono), Permission count (mono), Actions (Detail, Edit, Hapus). Any role with `isSystem = true` shows "Role sistem — tidak bisa diubah/dihapus" and Edit/Hapus hidden. The seeded example is `superadmin`, but the rule is flag-based.

**Drawer fields:** Nama*, Deskripsi, Permission picker (checkbox list, max-height 256px scroll, group labels). Above picker, persistent info alert **[ADJ-03]**: "Menyimpan akan mengganti seluruh permission role ini." Protected items show amber badge `protected`; disabled unless the actor has `isSystem = true` (backend rule).

**Catalog failure:** if permission catalog fails to load, show danger inline alert and **disable Simpan** **[ADJ-04]**.

**Detail panel:** name, description, users count, permission keys in mono.

**States:** loading/empty "Belum ada role."/error/success.

### 8.3 Permissions [EXISTING]

**Purpose:** manage canonical permission catalog and drift.
**Permissions:** `read:permission`, `create:permission`, `update:permission`, `delete:permission`.

**Filter row:** search key. Optional drift banner above table when `orphan` or `unregistered` non-empty **[EXISTING]**.

**Table columns:** Key (mono), Deskripsi, Status (protected badge/info), Role (comma list), Actions (Edit, Hapus).

**Drawer fields:** Key* (mono, disabled on edit), Deskripsi, Protected checkbox shown only when the actor has `isSystem = true` (the seeded system role `superadmin` is an example, not a whitelist). Helper text uses `<code>` styling for `action:resource` **[UX-19]**.

**Detail:** not separate; Edit drawer serves.

**States:** loading/empty "Belum ada permission."/error/success; 409 message for duplicate key.

### 8.4 Menus [EXISTING]

**Purpose:** manage menu tree and permission mapping.
**Permissions:** `read:menu`, `create:menu`, `update:menu`, `delete:menu`.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ "Menu" 24/600            [Tambah menu]                              │
│ subtitle: "Struktur menu, permission mapping (ANY-of)."             │
│ gap 16                                                              │
│ TREE panel p16                                                      │
│  ▸ Root menu              [terlihat]  perm: read:user               │
│    [Detail] [Submenu] [Edit] [Hapus]                                 │
│     └─ indent guide 20px per level (no inline margin hacks)          │
│  ▸ Group tanpa URL        [tersembunyi] perm: —                     │
│ gap 12                                                              │
│ Visibility note 12 muted: "Petunjuk UI, bukan aturan akses."         │
└──────────────────────────────────────────────────────────────────────┘
```

**Drawer fields:** Nama*, URL (/path kosong untuk group), Icon, Urutan, Parent select (without own descendants), Deskripsi, Aktif, Permission picker. If catalog fails, disable Simpan **[ADJ-04]**.

**Detail panel:** fields + permission keys mono; visibility labelled non-authoritative **[UX-15]**.

**States:** loading skeleton tree; empty "Belum ada menu."; error inline; success toast.

### 8.5 Delegations [EXISTING]

**Purpose:** manage capability delegation and lineage.
**Permissions:** `read:delegation`, `create:delegation`, `delete:delegation`.

**Table columns:** Grantee (username or mono ID fallback), Permission (mono), Grantor (username or mono ID), Expired (date muted), Status (valid/invalid semantic), Actions (Detail, Cabut).

**Drawer fields:** Grantee select*, Expires at `datetime-local` with helper "Maksimal 90 hari" and min/max attributes **[UX-12]**, Permission checkboxes, Simpan.

**Actual backend rules [VERIFIED: `auth-backend/src/delegation/delegation.service.ts:125-150`]:**

1. `grant:admin` can never be delegated, for any actor.
2. `create:delegation` requires `actor.isSystem` — a flag-based rule; the seeded system role is named `superadmin`, but the backend does not compare role names.
3. A permission with `isProtected = true` requires `actor.isSystem`.
4. An actor with `isSystem = false` must have both the permission **and** the capability for the key.
5. Self-delegation is forbidden; expiry must be in the future and ≤ 90 days.

**Current frontend visibility [VERIFIED: `auth-frontend/app/admin/delegations/page.tsx:22-24, 237-252`]:** the picker hides `grant:admin` for everyone and hides `create:delegation` unless the actor has a system role. This matches backend rules 1–2. It does **not** yet filter protected keys or keys outside the actor's permission ∩ capability, so backend rules 3–4 are enforced only on submit.

**UX recommendation [RECOMMENDATION]:** derive the checkbox list from the actual delegable set — exclude `grant:admin`; include `create:delegation` only when `actor.isSystem = true`; when `isSystem = false`, exclude `isProtected` keys and keys missing from `permissions ∩ capabilities`. Show a short helper: "Hanya key yang dapat Anda delegasikan yang ditampilkan; backend tetap memvalidasi." Do not infer restrictions from a role-name assumption. Backend remains authoritative.

If the permission catalog fails to load, disable Simpan **[ADJ-04]**.

**Detail panel:** grantee, grantor, permission, parent ID (mono; "root"), granted/expired dates, status, descendant IDs mono **[PLACEHOLDER styling only]**.

**Feedback after revoke:** persistent info panel listing `invalidatedDescendantIds` until dismissed **[ADJ-02]**.

**States:** loading/empty "Belum ada delegasi."/error/success.

---

## 9. Activity / Audit

### 9.1 Activity overview [EXISTING `/admin/audit-logs`]

**Purpose:** review administrative activity.
**Primary user:** Administrator, leads.
**Main task:** filter and inspect audit entries.
**Permission:** `read:audit`.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ "Activity / Audit" 24/600                                            │
│ subtitle: "Riwayat aksi administratif. action: resource.action" 12   │
│ gap 16                                                              │
│ FILTER GRID sm:grid-cols-3 gap=8:                                    │
│ [Action] [Resource type] [Actor ID]                                 │
│ [Resource ID] [From datetime] [To datetime] [Filter] [Reset]         │
│ gap 12                                                              │
│ TABLE: WAKTU | AKSI(mono) | RESOURCE | ACTOR | DETAIL                 │
│ pagination 32px — table and filters stay mounted behind the scrim    │
└──────────────────────────────────────────────────────────────────────┘

DETAIL DRAWER — definitive layout:
┌────────────────────────────────┐
│ right-side w=480 (720 ≥1280)   │  scrim rgba(17,24,39,.48)
│ Header: Detail audit log  [×]  │  footer: Tutup
│ Aksi (mono) / Resource / Actor │  14/body, 12 labels
│ Waktu 12 muted                 │
│ grid 2 cols: BEFORE | AFTER    │  mono 13/20, bg surface-subtle
└────────────────────────────────┘
  mobile: same drawer becomes full-screen
```

**Component hierarchy:** Activity > Filter form > Audit table > Detail drawer (before/after). The filter state, active page, and table context are preserved while the drawer is open.

**Actions:** Filter, Reset, Lihat (opens the right-side drawer), pagination. No export/delete.

**States:** loading skeleton rows; empty "Tidak ada audit log yang cocok."; error persistent error panel/toast with 403-specific message; success = filtered list.

**Constraint:** no project-level audit context; use existing `actorEmail`, `action`, `resourceType`, `resourceId`, `createdAt`, `before`, `after` only.

---

## 10. Responsive Behavior

| Screen group | ≥1024px | 768–1023px | <768px |
|---|---|---|---|
| Shell | 240px sidebar + topbar | icon rail or menu button | overlay sidebar 280px |
| Auth | 400px centered card | 400px card | full width minus 24px |
| Overview | 2-column grid | stacked grid | stacked, p12 |
| Projects list | full table | scroll-x table | scroll-x, filters wrap |
| Project detail | 2-column panels | stacked | stacked, tabs scroll |
| Team / Access lists | full table | scroll-x | scroll-x, action overflow |
| Drawers | 480/720px | 480px | full screen |
| Modals | 420px | 420px | 90vw |
| Activity detail | right-side drawer 480/720px, 2-col before/after | right-side drawer 480px, stacked before/after | full-screen drawer, stacked before/after |
| Menus tree | indent guides 20px | same | reduced indent 12px |

Tables never reflow into cards in MVP. Focus order and Escape behavior unchanged. Reduced motion removes drawer/scrim transitions.

---

## 11. Component and Interaction Inventory

| Component (Phase 03) | Used on | Variant notes |
|---|---|---|
| Button | All screens | One primary per view; danger only in confirm |
| Input / Textarea | Auth, drawers | Visible labels, inline errors |
| Select / dropdown | Team, Projects filters, Menus parent, Delegations grantee | Native select MVP |
| Checkbox / radio | Roles, Users, Menus, Delegations | 16px, 32px label hit area |
| Badge – Discipline | Team, Project detail | Neutral `#F0F2F5`, text `--color-text-secondary` |
| Badge – Access Role | Team, Users, profile | Blue tint, dynamic `{role.name}` from API; seeded examples `superadmin`/`Editor`/`Penulis` are illustrative only |
| Badge – Status | All lists | Semantic success/warning/danger/info |
| Card / summary panel | Overview, Project detail | No shadow, 1px subtle border |
| Table + Pagination | Projects, Team, Access lists, Activity | 40px rows, mono IDs, page numbers |
| ConfirmDialog | All destructive actions | 420px, focus trap |
| Drawer | Create/edit forms | 480/720px, full-screen mobile |
| Toast / alert | All mutations | Error persistent **[ADJ-02]** |
| Tabs + breadcrumbs | Project detail, shell | Breadcrumb from navigation registry |
| Loading / Empty / Error | All screens | Shared skeleton/empty components |

---

## 12. Loading / Empty / Error / Success States

| Screen group | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Auth | Button spinner + disabled | N/A | Persistent inline danger alert | Redirect / confirmation panel |
| Overview | Skeleton in Recent Activity | "Belum ada aktivitas/proyek" | Inline danger + Retry | Content visible |
| Projects | 5 skeleton rows | "Belum ada proyek" (no CTA) | Inline danger + Retry | Table/detail visible |
| Team | Skeleton rows | "Belum ada anggota" | Persistent error toast | Toast + refresh |
| Users | Skeleton rows | "Belum ada user." | Persistent error toast | Toast + refresh |
| Roles | Skeleton rows | "Belum ada role." | Persistent error + Save disabled if catalog fails | Toast + refresh |
| Permissions | Skeleton rows | "Belum ada permission." | Persistent error toast | Toast + refresh |
| Menus | Skeleton tree | "Belum ada menu." | Inline error + Save disabled if catalog fails | Toast + refresh |
| Delegations | Skeleton rows | "Belum ada delegasi." | Persistent error + Save disabled if catalog fails | Toast + descendant panel |
| Activity | Skeleton rows | "Tidak ada audit log yang cocok." | Persistent error (403-specific text) | Filtered list |

**Rule:** error notifications remain until user dismisses or resolves them **[ADJ-02]**; success/info may auto-dismiss after 5s.

---

## 13. Phase 01 Traceability Matrix

| UX ID | Wireframe response |
|---|---|
| UX-01 | §3 global shell for all signed-in screens |
| UX-02 | §3 sidebar from single navigation registry |
| UX-03 | §3 merged nav groups; no dynamic/static swap |
| UX-04 | §7.2, §8 drawers for create/edit |
| UX-05 | §8 one overlay at a time (drawer XOR detail XOR modal) |
| UX-06 | §4, §7.2, §8 visible field labels |
| UX-07 | §4, §8 inline validation |
| UX-08 | §8 shared ConfirmDialog everywhere |
| UX-09 | §12 shared error states + persistent toast |
| UX-10 | §3 nav visibility hint only; backend authoritative |
| UX-11 | §12 shared loading/empty/error |
| UX-12 | §8.5 expiry min/max + helper |
| UX-13 | §8.5 mono ID fallback; data concern noted, not styled away |
| UX-14 | §8.4 tree with indentation guides |
| UX-15 | §8.4 visibility note non-authoritative |
| UX-16 | §2 light mode baseline |
| UX-17 | §8 pagination with page numbers |
| UX-18 | §8.2/8.4/8.5 Save disabled on catalog failure |
| UX-19 | §8.3 `<code>` styling for key formats |
| UX-20 | §4 product name in auth card; metadata/lang noted in Phase 03 |
| UX-21 | §12 error toast persistent + `role=alert` |
| UX-22 | §3 breadcrumb from navigation registry |
| UX-23 | §8 action column max 3, compact buttons |
| UX-24 | §12 empty states with permitted CTA only |

---

## 14. Phase 02 User Flow Coverage

| Phase 02 flow | Covered screens | Status |
|---|---|---|
| 7.1 Login and entering workspace | §4.1 → §3 → §5 | Existing + planned context |
| 7.2 Viewing studio overview | §5 | Existing page, planned enrichment |
| 7.3 Finding/accessing project | §6.1 → §6.2 | Fully planned |
| 7.4 Managing team members | §7.1 → §7.2 | Planned page reusing existing user data |
| 7.5 Assigning access roles | §8.1 Users drawer | Existing |
| 7.6 Managing permissions | §8.2 Roles, §8.3 Permissions | Existing |
| 7.7 Reviewing studio activity | §9 → §5 Recent Activity | Existing |

---

## 15. Open Design Decisions

1. Project status values and who may set them.
2. Whether the Discipline field exists in MVP or remains a disabled placeholder.
3. What "New project" permission will be called; no CTA until defined.
4. Final access-role naming: keep seeded `superadmin`/`Editor`/`Penulis` or rename to Administrator/Editor/Viewer. The UI must render whatever names the API returns; do not hardcode either set.
5. Exact error toast dismissal rule: manual only, or minimum duration plus manual (ADJ-02 accepted but duration unspecified).
6. Whether project membership is needed in MVP.
7. Whether `/articles` remains in primary navigation (Phase 02 says demote).
8. Whether own-account actions are hidden or disabled with tooltip (backend restriction verified; UI is a recommendation).
9. Acceptance of ADJ-01…ADJ-04 before Phase 05.

**Resolved in this correction:** Activity detail uses a right-side drawer on desktop and a full-screen drawer on mobile; it never replaces the table or the filter state.

---

## 16. Phase 05 Implementation Readiness Checklist

- [ ] ADJ-01…ADJ-04 accepted and reflected in the design-token/component plan.
- [ ] Shell measurements (240/56/32/1280) confirmed.
- [ ] Auth card and field layouts confirmed.
- [ ] Overview data sources confirmed: identity, dynamic roles, permissions, audit; My Projects not rendered in MVP.
- [ ] Project screens confirmed as [PLANNED]; no API claim.
- [ ] Team discipline field status confirmed.
- [ ] Roles rendered dynamically from API; `isSystem` drives system-role behavior; no hardcoded role-name comparisons.
- [ ] Role save replacement note included.
- [ ] Catalog-failure save blocking included in Roles/Menus/Delegations.
- [ ] Activity uses existing audit fields only.
- [ ] Error toast persistence implemented.
- [ ] Drawer/modal/focus/keyboard behavior confirmed.
- [ ] Responsive rules confirmed; tables scroll horizontally.
- [ ] Light mode only; WCAG AA contrast preserved.
- [ ] Reduced-motion behavior included in handoff.
- [ ] No postponed module appears in implementation scope.

**Phase 05 may begin only after these checkboxes are accepted. This phase produces no code.**

---

**STOP — Phase 04 complete. Awaiting review before implementation.**
