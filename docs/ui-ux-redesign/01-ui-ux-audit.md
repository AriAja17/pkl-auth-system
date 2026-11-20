# Phase 01 — UI/UX Audit: Existing Frontend

**Project:** PKL Auth System → Studio Management Platform (direction)
**Branch:** `design/studio-management-ui-ux`
**Date:** 2026-11-20
**Scope:** UI/UX audit only. No source code, behavior, backend, schema, or dependency changes were made.

**Notation used in this report**

- **[VERIFIED]** — observed directly in the current repository source.
- **[ASSUMPTION]** — design perspective or future workflow, not implemented or confirmed.
- **[RECOMMENDATION]** — proposed direction for a later phase, not an existing feature.

---

## 1. Executive Summary

This audit inspected every frontend route and shared module that currently exists in `auth-frontend/`. The application is, in its present state, a **role-and-permission administration demo** built with Next.js App Router, Tailwind CSS utility classes, and a thin `fetch` wrapper around a NestJS API.

**What works well [VERIFIED]**

- Authentication state is centralized in `AuthProvider`, with a single `/auth/me` load on mount and a canonical `has()` permission check (`lib/auth-context.tsx:31-137`).
- A small set of reusable UI primitives exists: `Toast`, `ConfirmDialog`, `Pagination`, `LoadingState`, and `EmptyState` (`app/admin/_components/ui.tsx:1-125`).
- All six admin resource pages follow a predictable pattern: header → optional form → optional detail → search → table → pagination.
- The API layer is centralized (`lib/api.ts`), with a typed `ApiError` and typed response models (`lib/api-types.ts`).
- Client-side UI hides actions the user cannot perform (`has('create:user')`, `has('delete:role')`, etc.), and backend permissions remain authoritative.

**Main problems [VERIFIED]**

1. There are **two different application shells**: admin pages use `AppShell`/`Sidebar`, while dashboard and articles render standalone pages with their own ad-hoc headers.
2. Navigation configuration is **duplicated in three places** (`Sidebar.tsx`, `admin/page.tsx`, `dashboard/page.tsx`) and can drift.
3. The sidebar **switches entirely** between a dynamic menu tree and a static fallback; valid admin destinations can disappear from navigation.
4. Create/edit forms are **inline panels above the list**, causing long pages and loss of context; the article page even calls `window.scrollTo` to compensate.
5. Error handling, validation messages, loading/empty states, and confirmation dialogs are **inconsistent across pages**.
6. There is effectively **no design-token system**: only two CSS variables exist, and pages hardcode light-mode Tailwind colors, which conflicts with the global dark-mode media query.
7. A silent failure when loading the permission catalog can let a user **save a menu with an empty permission list**, potentially clearing existing mappings.

**Conclusion [VERIFIED + RECOMMENDATION]**

The current frontend is a usable internal RBAC tool, but it is not yet a Studio Management Platform. No studio-domain concepts (projects, assets, tasks, teams as studio roles, builds, QA flows) exist in the code. The highest-value work before adding domain features is to unify the application shell/navigation, consolidate shared components and error handling, and establish a minimal design-token and interaction foundation.

---

## 2. Existing Frontend Architecture

### 2.1 Framework and routing [VERIFIED]

- Next.js App Router with TypeScript; every page is a client component (`'use client'` at the top of all `page.tsx` files).
- `next.config.ts:9-17` redirects `/` to `/login`.
- `app/layout.tsx:21-31` wraps the whole app in `AuthProvider` and loads `globals.css`.
- Route folders that actually exist: `login`, `register`, `dashboard`, `articles`, `admin`, `admin/users`, `admin/roles`, `admin/permissions`, `admin/menus`, `admin/delegations`, `admin/audit-logs`.
- `app/admin/layout.tsx:1-7` applies `AppShell` to all `/admin/*` routes only.

### 2.2 Data and session layer [VERIFIED]

- `lib/api.ts:27-57` — generic `api<T>()` wrapper; attaches `Authorization: Bearer <token>` from `localStorage`, maps Nest messages into `ApiError`, throws `ApiError(0)` on network failure.
- `lib/api.ts:59-65` — `apiPage<T>()` for `{ items, total, page, limit }` responses.
- `lib/auth-context.tsx:31-137` — session state, `has()`, `refresh()`, `logout()`.
- `lib/api-types.ts:1-90` — TypeScript mirrors of backend responses.
- Each data page implements its own `useCallback(load)` + `useEffect`, with a local `active` flag to avoid setting state after unmount.

### 2.3 Shared components [VERIFIED]

- `app/admin/_components/AppShell.tsx` — admin header, mobile sidebar toggle, sidebar slot, content area.
- `app/admin/_components/Sidebar.tsx` — dynamic menu tree plus static fallback sections.
- `app/admin/_components/ui.tsx` — `Toast`, `ConfirmDialog`, `Pagination`, `LoadingState`, `EmptyState`.
- Page-local helpers that are reusable candidates: `flatten()` and `descendantsOf()` in `admin/menus/page.tsx:41-60`; `safeJson()` in `admin/audit-logs/page.tsx:35-49`.

### 2.4 Styling and design tokens [VERIFIED]

- `app/globals.css:1-26` imports Tailwind 4 and defines only `--background` and `--foreground`, plus a `prefers-color-scheme: dark` override.
- `app/layout.tsx:6-14` loads Geist/Geist Mono font variables, but `globals.css:25` sets `font-family: Arial, Helvetica, sans-serif` on `body`.
- All visible styling is inline Tailwind utility strings (`bg-gray-50`, `bg-white`, `rounded-xl`, `shadow`, `text-blue-600`, etc.). There is no shared button, input, card, table, or badge component.
- No modal system except `ConfirmDialog`; no dropdown menu component; no toast provider (each page renders its own `Toast`).

### 2.5 Forms, tables, navigation [VERIFIED]

- Forms use native `<input>`, `<select>`, `<textarea>`, and checkboxes with inline `onChange` state updates.
- Tables are raw `<table>` elements inside `overflow-x-auto` wrappers.
- Navigation uses Next `Link` and `useRouter().replace()` for auth redirects.
- Feedback is rendered as a single toast string, a single inline alert, or a detail card depending on the page.

---

## 3. Existing Page Inventory

Only routes present in the repository are listed.

| Route | Purpose | Main user actions | Information displayed | Interaction pattern | Evidence |
|---|---|---|---|---|---|
| `/login` | Sign in | Enter email/password, submit, go to register | Error alert, loading state | Centered card, inline form | `app/login/page.tsx:1-96` |
| `/register` | Create account | Enter email/optional username/password, submit | Success panel with link to login | Centered card, inline form + success swap | `app/register/page.tsx:1-122` |
| `/dashboard` | Session overview | Logout, open admin panel, open articles | Email, roles, canonical permissions | Standalone card, link buttons | `app/dashboard/page.tsx:1-93` |
| `/articles` | Example protected CRUD | Create/edit/delete article, filter by permission | Article list, permission summary, toast | Standalone page, inline form above list, native confirm on delete | `app/articles/page.tsx:1-266` |
| `/admin` | Admin landing | Open one of six admin sections | Username, permission-filtered section cards | Card grid inside `AppShell` | `app/admin/page.tsx:1-49` |
| `/admin/users` | User and role assignment | Create/edit user, toggle active, delete, view detail, search, paginate | User table, role picker, detail card | Inline form, detail card, confirm dialog, table | `app/admin/users/page.tsx:1-468` |
| `/admin/roles` | Role and permission management | Create/edit/delete role, view detail, search, paginate | Role table, permission checkbox picker | Inline form, detail card, confirm dialog, table | `app/admin/roles/page.tsx:1-382` |
| `/admin/permissions` | Permission catalog and drift | Create/edit/delete permission, view drift, search, paginate | Permission table, protected badge, roles, drift banner | Inline form, confirm dialog, table | `app/admin/permissions/page.tsx:1-334` |
| `/admin/menus` | Menu tree management | Create root/submenu, edit, delete, view detail | Indented tree, visibility hint, permission keys | Inline form, detail card, confirm dialog, tree | `app/admin/menus/page.tsx:1-482` |
| `/admin/delegations` | Capability delegation | Create delegation, revoke, filter by grantee, view detail | Delegation table, valid/invalid status, descendant IDs | Inline form, detail card, confirm dialog, table | `app/admin/delegations/page.tsx:1-382` |
| `/admin/audit-logs` | Audit log browsing | Filter by action/resource/actor/time, view before/after, paginate | Audit table, detail panel with JSON | Filter form, detail panel, table | `app/admin/audit-logs/page.tsx:1-243` |

---

## 4. Current UI/UX Evaluation

### 4.1 Information hierarchy [VERIFIED]

Admin pages use a consistent top-down hierarchy: page title and description, primary action button, transient form/detail, then the data table. This is predictable. However, the optional panels are injected **between** the header and the table, so opening a form or detail pushes the primary content down and changes the visual hierarchy mid-task.

Dashboard and Articles do not share this structure; both use a single centered column with a plain header.

### 4.2 Navigation clarity [VERIFIED]

The admin area has a persistent sidebar with active-link styling and a mobile toggle (`AppShell.tsx:24-58`, `Sidebar.tsx:22-28`). Outside `/admin`, navigation is limited to inline links on the dashboard and article page. There are no breadcrumbs, so a user several admin actions deep has no path context.

The sidebar's dynamic/static switch (`Sidebar.tsx:64-66, 86-113`) means the navigation shape changes depending on whether any menu rows with URLs exist. This is a significant clarity problem.

### 4.3 User flow [VERIFIED]

Common create/edit flow: click "Tambah …" → inline form appears at top → fill → submit → toast → form closes → list reloads. This works but creates extra scrolling and does not preserve scroll position. The article page works around this with `window.scrollTo({ top: 0 })` when editing (`articles/page.tsx:101-106`).

Deletion flow is consistent in admin pages through `ConfirmDialog`, but Articles uses `window.confirm` (`articles/page.tsx:109`), breaking consistency.

### 4.4 Consistency [VERIFIED]

The admin resource pages are structurally similar, but small details differ: some pages include detail cards, some do not; some show drift banners; audit logs use a six-field filter grid while other pages use a single search field. Error messages for the same HTTP status differ slightly by page.

### 4.5 Forms and data tables [VERIFIED]

Forms are unlabelled input fields with placeholder text. Validation is implemented per page with ad-hoc regular expressions and a single toast message. Tables use raw HTML with fixed columns and an `overflow-x-auto` wrapper. Pagination shows only "Sebelumnya"/"Berikutnya".

### 4.6 Feedback and validation [VERIFIED]

Success and error feedback is rendered through `Toast` (`role="status"` for both), inline red alert boxes on auth pages, or amber banners for drift. There is no field-level error display, no optimistic UI, and no disabled/retry state distinction beyond a generic `busy`/`loading` boolean.

### 4.7 Loading, empty, error, success states [VERIFIED]

Admin pages use `LoadingState` and `EmptyState`; dashboard/articles use plain `<p>` elements. Audit logs show a toast for errors but no inline error panel. Success is always a toast; there is no persistent activity center.

### 4.8 Responsive behavior [VERIFIED]

The app is desktop-first but uses responsive utilities: admin sidebar collapses behind a "Menu" button on small screens (`AppShell.tsx:25-32, 46-57`), forms use `sm:grid-cols-2`, and tables scroll horizontally. There is no dedicated mobile navigation pattern for non-admin pages and no responsive redesign of the dynamic menu tree beyond indentation.

### 4.9 Basic accessibility [VERIFIED / RECOMMENDATION]

Positive: `role="alert"` on auth errors, `role="status"` on toasts, `aria-label` on the mobile menu button and toast close button.

Gaps: inputs have no associated `<label>`; icon meanings rely on text color only; error toasts are announced as status rather than alert; `<html lang="en">` conflicts with the Indonesian UI; focus management after opening dialogs/forms is not implemented.

### 4.10 Security-related UX constraint [VERIFIED]

`accessToken` is stored in `localStorage` (`lib/api.ts:14-25`). This is a known constraint, not a UI bug, but any future Studio Management design should treat session storage as a separate decision gate.

---

## 5. Findings and Issues

All items below are **[VERIFIED]** from source. Priority reflects impact on the Studio Management redesign, not severity of a production incident.

### 5.1 High priority

| ID | Page/component | Evidence | Problem | User impact | Recommended direction |
|---|---|---|---|---|---|
| UX-01 | Global layout | `app/admin/layout.tsx:1-7`, `AppShell.tsx:22-61`, `dashboard/page.tsx:35-42`, `articles/page.tsx:139-164` | Two-shell architecture: admin uses a header/sidebar shell; dashboard and articles are standalone cards with inline headers. | Navigation and branding change abruptly when moving between areas; extra clicks to return. | Introduce one authenticated application shell used by all signed-in routes, with role-aware navigation. |
| UX-02 | Navigation config | `Sidebar.tsx:6-13`, `admin/page.tsx:6-13`, `dashboard/page.tsx:8-16` | The same admin section list / permission keys are hardcoded in three files. | New or renamed sections can be missing in one place; permissions drift. | Define a single navigation registry consumed by sidebar, admin landing, and dashboard. |
| UX-03 | Sidebar | `Sidebar.tsx:64-66, 86-113` | If any dynamic menu has a URL or child, static admin links disappear entirely; if dynamic menus omit a section, it is no longer reachable from the sidebar. | Valid destinations become hidden; depends on database menu configuration. | Merge static admin shortcuts and dynamic menus into one grouped navigation model; never fully replace one with the other. |
| UX-04 | All create/edit forms; Articles | `users/page.tsx:263-354`, `roles/page.tsx:223-283`, `permissions/page.tsx:204-248`, `menus/page.tsx:360-452`, `delegations/page.tsx:208-271`, `articles/page.tsx:101-106, 179-224` | Forms are inline panels above the list; article editing calls `window.scrollTo` to reach the form. | Long pages, lost context, unnecessary scrolling, especially on laptops. | Move create/edit into a modal/drawer or dedicated route; preserve list context and scroll position. |
| UX-18 | Menu edit / permission pickers | `menus/page.tsx:177-203`, `roles/page.tsx:72-85` | If the permission catalog fails to load, the error is swallowed; menu edit maps all keys to `[]`, and saving can clear permission mappings. | Silent loss of menu visibility configuration; user is not warned. | Block save when the catalog is unavailable, show an explicit error, and preserve the existing keys from the row. |

### 5.2 Medium priority

| ID | Page/component | Evidence | Problem | User impact | Recommended direction |
|---|---|---|---|---|---|
| UX-05 | Users page | `users/page.tsx:245-246, 263, 356, 374` | Form, detail card, and confirmation dialog can be open simultaneously. | Visual clutter and unclear focus; possible accidental action on stale data. | Make overlay states mutually exclusive with a single panel/dialog manager. |
| UX-06 | All forms | `login/page.tsx:57-70`, `register/page.tsx:75-95`, `users/page.tsx:270-305`, `roles/page.tsx:227-238` | Inputs rely on placeholders; no persistent labels or `htmlFor`. | Labels vanish while typing; screen readers and autofill are weaker. | Add visible labels and accessible names to every field. |
| UX-07 | Auth/admin forms | `login/page.tsx:17-24`, `users/page.tsx:157-160`, `permissions/page.tsx:111-114`, `menus/page.tsx:208-219`, `delegations/page.tsx:123-126` | Validation is duplicated and reports one generic toast, not field-level errors. | User must guess which field failed; inconsistent wording. | Use one validation layer with inline field messages and a summary. |
| UX-08 | Articles vs admin pages | `articles/page.tsx:109`, `ui.tsx:37-76` | Native `window.confirm` vs custom `ConfirmDialog`. | Inconsistent, unstyled destructive confirmation. | Use the shared dialog everywhere. |
| UX-09 | Every data page | `users/page.tsx:101-118`, `roles/page.tsx:87-104`, `permissions/page.tsx:75-92`, `menus/page.tsx:153-170`, `delegations/page.tsx:96-113`, `audit-logs/page.tsx:74-95` | Near-identical `handleError` functions are copy-pasted per page. | Divergent messages and high maintenance cost. | Centralize HTTP error mapping in the API layer or a shared hook. |
| UX-10 | Session handling | `auth-context.tsx:39-80`, `lib/api.ts:27-57`, 401 branches in all data pages | `/auth/me` loads once on mount; permission changes require manual refresh; 401 cleanup is repeated in pages and may leave stale `me` state. | UI can show actions the backend will deny; stale session state. | Add centralized 401 handling and refresh-on-focus/visibility after role changes. |
| UX-11 | State components | `ui.tsx:117-125`, `dashboard/page.tsx:26-28`, `articles/page.tsx:120-122`, `audit-logs/page.tsx:198-202` | Loading/empty/error states are implemented inconsistently. | Uneven feedback quality across the product. | Adopt shared state components globally with retry/CTA options. |
| UX-12 | Delegations form | `delegations/page.tsx:122-126, 224-229` | Expiry input has no `min`/`max` or 90-day helper beyond static text; error says "expired date". | Users submit invalid dates and receive generic errors. | Add min/max constraints, clear helper text, and inline validation. |
| UX-13 | Delegations table | `delegations/page.tsx:43-47, 79-85, 342-344` | Grantee/grantor names resolve only from the first 100 users; others show raw IDs. | Hard to read delegation ownership. | Resolve names via a dedicated lookup or display email alongside ID. |
| UX-14 | Menus tree | `menus/page.tsx:292-335` | Tree uses inline `marginLeft: depth * 20`; no collapse/expand, indentation guides, or reorder controls. | Deep hierarchies are hard to scan and manage. | Use a dedicated tree component with indentation guides and collapse. |
| UX-15 | Menus visibility | `menus/page.tsx:127-151` | Frontend recomputes backend visibility rules from permission keys. | Rules can drift from backend `visibleMenus`; display may mislead. | Treat visibility as backend-provided data or label it explicitly as a non-authoritative hint. |
| UX-16 | Theming | `globals.css:15-20`, `dashboard/page.tsx:35`, `ui.tsx:53-55`, `AppShell.tsx:23` | Dark-mode CSS variables conflict with hardcoded light utility classes. | Dark-mode users get broken or partial theming. | Decide one supported theme; drive all surfaces from design tokens. |
| UX-17 | Pagination | `ui.tsx:78-115` | Only previous/next buttons; no page numbers, totals per page, or page-size control. | Hard to navigate large datasets. | Add page numbers, current-range label, and optional page size. |

### 5.3 Low priority

| ID | Page/component | Evidence | Problem | User impact | Recommended direction |
|---|---|---|---|---|---|
| UX-19 | Permissions / Audit logs | `permissions/page.tsx:181-183`, `audit-logs/page.tsx:106-109` | Literal backticks are rendered in UI copy (`action:resource`, `resource.action`). | Unpolished presentation. | Use `<code>` styling or plain text. |
| UX-20 | Root layout | `app/layout.tsx:16-19, 24` | Metadata is still "Create Next App" and `lang="en"` while UI is Indonesian. | Weak branding; wrong screen-reader language. | Set product metadata and `lang="id"`. |
| UX-21 | Toast | `ui.tsx:22-34`, `articles/page.tsx:141-155` | Errors use `role="status"` instead of `role="alert"`. | Errors may not be announced urgently. | Use `role="alert"` for error toasts. |
| UX-22 | Admin shell | `AppShell.tsx:24-40` | No breadcrumbs; header title is always "Panel Administrasi". | Weak orientation on nested pages. | Add breadcrumbs driven by the navigation registry. |
| UX-23 | Table actions | `users/page.tsx:427-453`, `roles/page.tsx:349-367` | Multiple underline text links per row with small hit areas and no consistent button hierarchy. | Visual noise and harder clicking. | Use compact icon+label buttons with consistent hierarchy. |
| UX-24 | Empty states | `roles/page.tsx:323`, `permissions/page.tsx:272`, `audit-logs/page.tsx:201` | Empty states show text only, no next action. | Dead-end for new users. | Add contextual CTA where the user has permission. |

---

## 6. Existing Reusable Components

**[VERIFIED]**

| Component / module | Location | Reuse status | Notes |
|---|---|---|---|
| `Toast` | `app/admin/_components/ui.tsx:7-35` | Shared in admin pages, duplicated inline in Articles (`articles/page.tsx:141-156`) | Candidate for app-wide provider. |
| `ConfirmDialog` | `ui.tsx:37-76` | Shared in admin pages; Articles uses native confirm | Should be the single destructive-action pattern. |
| `Pagination` | `ui.tsx:78-115` | Used by users, roles, permissions, delegations, audit logs | Not used by menus (tree). |
| `LoadingState` / `EmptyState` | `ui.tsx:117-125` | Used by admin pages only | Dashboard/articles use plain `<p>`. |
| `AppShell` | `app/admin/_components/AppShell.tsx` | Admin routes only | Should become the global authenticated shell. |
| `Sidebar` | `app/admin/_components/Sidebar.tsx` | Admin routes only | Contains duplicated section config. |
| `api` / `apiPage` / `ApiError` | `lib/api.ts` | App-wide | Good foundation for centralized error handling. |
| `useAuth` / `has` | `lib/auth-context.tsx` | App-wide | Canonical permission source for UI. |
| `flatten` / `descendantsOf` | `admin/menus/page.tsx:41-60` | Page-local | Good candidates for shared tree utilities. |
| `safeJson` | `admin/audit-logs/page.tsx:35-49` | Page-local | Could be shared for audit/detail views. |
| `handleError` | Repeated in 7 pages | Duplicated, not shared | Highest-value consolidation target. |

---

## 7. Current vs Proposed Information Architecture

### 7.1 Current IA [VERIFIED]

```text
/ → /login (redirect)
├── /login
├── /register
├── /dashboard                 standalone
├── /articles                  standalone
└── /admin                     AppShell
    ├── /admin/users
    ├── /admin/roles
    ├── /admin/permissions
    ├── /admin/menus
    ├── /admin/delegations
    └── /admin/audit-logs
```

### 7.2 Proposed IA for Studio Management [RECOMMENDATION — NOT IMPLEMENTED]

```text
/sign-in                       (or keep /login)
/dashboard                     Studio overview
/projects                      [future] project list
/projects/:id                  [future] project workspace
/assets                        [future] art/audio/asset library
/team                          [future] members and studio roles
/access                        reuse RBAC: users, roles, permissions
/workflows                     [future] tasks/reviews/builds
/audit                         reuse audit log
/settings                      [future] studio settings
```

This is a direction only. None of the `[future]` routes or entities exist in the repository.

---

## 8. Potential Studio User Workflows

All content in this section is **[ASSUMPTION]** — design perspectives used to evaluate reuse, not confirmed roles or features.

| Perspective | Assumed goal | Current reusable touchpoints [VERIFIED] | Missing for this workflow [ASSUMPTION] |
|---|---|---|---|
| Studio Administrator | Manage who can see and do what; review activity | User/role/permission pages, delegation, audit log, sidebar permissions | Studio-level settings, project-level access scopes, onboarding flow |
| Game Developer | Access assigned project tools and code/build workflows | Login, dashboard, permission-gated navigation | Project workspace, repository/build links, task queue |
| Game Designer | Maintain design docs and gameplay specs | Articles page as a crude document CRUD example | Structured design documents, versioning, review state |
| Artist | Upload and organize visual assets | None specific; only generic RBAC | Asset library, metadata, thumbnails, storage quotas |
| QA Tester | Record and triage bugs against builds | None specific; audit log is admin-only | Bug tracker, test runs, build annotations, status workflow |

**Assessment [RECOMMENDATION]:** only the Administrator perspective has meaningful current tooling. The other four require new domain surfaces; the Articles page can serve as a temporary pattern study, not as a final design document or asset tool.

---

## 9. Existing Capabilities vs Future Feature Gaps

| Category | Current capability [VERIFIED] | Direction [RECOMMENDATION] |
|---|---|---|
| Reuse as-is | Authentication, JWT session, canonical permission keys, multi-role assignment, permission-aware UI, audit log, menu tree, delegation with lineage | Keep the backend contract and permission model; reuse the API wrapper and auth context. |
| Restructure | Admin shell/sidebar, inline forms, duplicated navigation configs, per-page error handling, hardcoded colors | Unify shell, navigation registry, form/dialog patterns, error layer, and design tokens before adding domain pages. |
| Missing for Studio Management | Projects, assets, tasks/reviews, studio roles beyond RBAC, project switcher, dashboards with operational metrics, search across entities | Add as later feature slices after the UX foundation is stable. |
| Postpone | Real-time collaboration, analytics dashboards, billing, public portals, complex workflow automation, native mobile apps | Not appropriate for the current PKL-scope prototype. |

---

## 10. Recommended Visual Direction

**Evaluation of "Modern Minimal SaaS Dashboard" [RECOMMENDATION]**

The direction is **suitable** for an internal studio tool because the current application is already a dense, table-and-form oriented admin product. It does not require a marketing-style redesign. Improvements should focus on systematization rather than decoration:

1. **Design tokens:** replace the two-CSS-variable setup with a small token set for surface, text, border, accent, success/warning/danger, spacing scale, radii, and shadow. Drive all components from tokens.
2. **Typography:** keep one sans family; define a clear scale for page title, section title, body, helper text, and table labels. Fix the Geist/Arial conflict and the `lang`/metadata defaults.
3. **Layout:** one authenticated shell with a collapsed-capable sidebar, a top bar with project/studio context, breadcrumbs, and a content area with consistent max widths.
4. **Navigation:** single registry; group "Access", "Operations", and "Settings"; merge dynamic menus with static sections instead of swapping them.
5. **Components:** shared Button, Input, Select, Checkbox, Badge, Card, Table, Drawer/Modal, Toast, and Empty/Loading/Error states.
6. **Tables and forms:** desktop-first tables with sticky headers and clear action columns; forms in drawers or dedicated pages with visible labels and inline validation.
7. **Feedback:** consistent toast/alert semantics, success confirmation, destructive double-check, and retry affordances.
8. **Responsive:** desktop-first, but keep the mobile sidebar pattern and ensure tables scroll rather than reflow badly.
9. **Accessibility:** labels, focus states, `role="alert"` for errors, keyboard-dismissable dialogs, and correct document language.
10. **Theme:** choose light mode only for now, or implement dark mode properly with tokens; the current partial dark mode is worse than no dark mode.

No new design is implemented in this phase.

---

## 11. Redesign Priority and Suggested Phase Order

| Phase | Focus | Addresses | Exit condition |
|---|---|---|---|
| 0 — Audit (this document) | Verify current state | All findings catalogued | Report reviewed and accepted |
| 1 — Foundation | Global shell, navigation registry, design tokens, shared primitives | UX-01, UX-02, UX-03, UX-16, UX-20 | One shell across authenticated routes; one nav config; tokenized base components |
| 2 — Interaction consolidation | Form/drawer pattern, labels, validation, dialogs, error layer, states | UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-19, UX-21, UX-23, UX-24 | Consistent create/edit/delete/feedback across existing pages |
| 3 — Admin robustness | Permission catalog failure handling, delegation constraints, menu tree, pagination | UX-12, UX-13, UX-14, UX-15, UX-17, UX-18 | No silent destructive saves; navigable trees and lists |
| 4 — Studio IA | Introduce project/asset/team information architecture as design proposals | Section 7/8/9 | Approved IA and domain model, no code yet |
| 5 — Feature slices | Implement future studio capabilities incrementally | Section 9 gaps | One domain slice at a time, validated with users |

---

## 12. Final Recommendations

1. Treat the current frontend as a **working RBAC admin prototype**, not a Studio Management product.
2. Do the foundation work in Phases 1–3 before adding studio-domain pages; otherwise the same duplicated patterns will be multiplied.
3. Keep the backend permission model and API contract stable; most redesign value is in shell, navigation, components, and interaction states.
4. Make the navigation registry and design tokens the single source of truth for structure and visuals.
5. Resolve UX-18 before any further menu/role editing work, because it can silently remove permission mappings.
6. Validate the five studio perspectives with the mentor before committing to the proposed IA; the role names in Section 8 are assumptions.
7. Keep the final direction aligned with "Modern Minimal SaaS Dashboard": clean, dense-but-ordered, token-driven, desktop-first, and accessible.

**Limitations of this audit [VERIFIED]:** no runtime browser session with a real Supabase database was used, so no interaction was observed against production-like data; all findings are based on static source inspection of the current branch. No screenshots, analytics, user interviews, or usability tests were available. This report intentionally does not propose a final visual design or implementation.

---

**STOP — Phase 01 audit complete. Awaiting review before any redesign implementation.**
