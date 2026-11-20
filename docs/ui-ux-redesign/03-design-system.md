# Phase 03 — Design System & Visual Foundation

**Project:** PKL Auth System → Studio Management Platform
**Branch:** `design/studio-management-ui-ux`
**Date:** 2026-11-20
**Depends on:** `01-ui-ux-audit.md` (approved), `02-information-architecture-and-user-flows.md` (approved)
**Scope:** visual design specification only. No CSS, Tailwind config, components, wireframes, or application source code are created or modified.

**Notation**

- **[VERIFIED]** — observed in current source or approved earlier documents.
- **[RECOMMENDATION]** — proposed specification for later implementation.
- **[CONSTRAINT]** — must be preserved from Phase 01/02.

---

## 1. Design Philosophy

The design system should make a small studio feel **organized, calm, and capable**, not like a generic admin template or a gaming marketing site.

**Principles [RECOMMENDATION]**

1. **Content before decoration.** Density is acceptable; visual noise is not.
2. **One semantic color, one meaning.** Blue = brand/action, green = success, amber = warning, red = danger, teal = information. Never reuse a status color for branding.
3. **Flat surfaces, precise borders.** Use surface color and a 1px border to define structure instead of shadows and stacked cards.
4. **Typography carries hierarchy.** Size, weight, and color do the work that oversized cards and gradients usually hide.
5. **Dense but readable.** Default body text is 14px with 22px line height; tables stay scannable on a laptop screen.
6. **Predictable interactions.** Every control has one clear primary state, one hover, one focus, one disabled, and one error treatment.
7. **Accessibility is part of the visual spec.** All contrast ratios are calculated, not assumed.

**Explicitly avoided [RECOMMENDATION]**

- Gradients, glassmorphism, neon/RGB effects, gaming-style glows.
- Large rounded card stacks, playful illustrations, decorative animation.
- Enterprise dashboards with dozens of unrelated widgets.
- Marketing-style hero sections inside the authenticated product.

---

## 2. Visual Direction

**"Modern Minimal SaaS Dashboard" — interpretation for this product [RECOMMENDATION]**

| Characteristic | Interpretation |
|---|---|
| Professional and clean | Neutral cool-gray canvas, white work surfaces, one restrained brand blue. |
| Modern but not decorative | Geist typography, tight spacing rhythm, flat cards, no embellishment. |
| Clear typography hierarchy | 24/18/16/14/12px scale with consistent weights and colors. |
| Consistent spacing and components | 4px base scale; 8px rhythm; shared component rules. |
| Practical for daily studio operations | Tables, filters, compact badges, and predictable form drawers. |
| Desktop-first | 240px sidebar, 56px topbar, 1280px max content; responsive collapse at defined breakpoints. |

**Product context supported [CONSTRAINT from Phase 02]**

- Overview, Projects, Team, Access Management, Activity / Audit.
- Single workspace assumption; project context is visual context only, not authorization.
- Studio Discipline and Access Role are visually distinct.
- Backend authorization remains authoritative; UI badges never grant access.

---

## 3. Color System

### 3.1 Token naming convention [RECOMMENDATION]

`--color-{category}-{role}[-{variant}]`, for example `--color-brand-primary`, `--color-text-muted`, `--color-status-danger-surface`.

### 3.2 Final recommended palette — light mode baseline [RECOMMENDATION]

| Token | HEX | Semantic purpose |
|---|---|---|
| `--color-brand-primary` | `#3357A8` | Primary buttons, links, active nav indicator, selected row accent. |
| `--color-brand-primary-hover` | `#2A4789` | Hover state of primary controls. |
| `--color-brand-primary-active` | `#213A70` | Pressed/active state of primary controls. |
| `--color-brand-primary-subtle` | `#EEF2FB` | Selected nav background, hover row, primary tint. |
| `--color-brand-primary-subtle-hover` | `#E4EAF8` | Stronger hover on tinted surfaces. |
| `--color-brand-secondary` | `#4A5568` | Secondary text, secondary button label, neutral emphasis. |
| `--color-brand-secondary-subtle` | `#F0F2F5` | Neutral chip background, discipline badge background. |
| `--color-canvas` | `#F5F6F8` | Application background behind surfaces. |
| `--color-surface` | `#FFFFFF` | Cards, tables, panels, modal/drawer body. |
| `--color-surface-subtle` | `#F8F9FB` | Nested subtle areas, code blocks, skeleton base. |
| `--color-border-subtle` | `#E3E6EB` | Decorative dividers, card borders, table row separators. |
| `--color-border-strong` | `#838E9F` | Input borders, control outlines, interactive boundaries. |
| `--color-border-discipline` | `#C9CFD8` | Studio Discipline badge border (neutral). |
| `--color-border-access` | `#C9D6F0` | Access Role badge border (brand tinted). |
| `--color-divider` | `#ECEEF2` | Row dividers inside tables and lists. |
| `--color-text-primary` | `#1B2230` | Headings, body text, table values. |
| `--color-text-secondary` | `#4A5568` | Supporting text, labels, table headers. |
| `--color-text-muted` | `#646D7D` | Timestamps, helper text, low-priority metadata. |
| `--color-text-on-brand` | `#FFFFFF` | Text on primary/danger/status solid colors. |
| `--color-interactive-focus` | `#2F6FED` | Focus ring on light surfaces. |
| `--color-interactive-hover` | `#EDF1FA` | Generic hover fill for ghost controls. |
| `--color-status-success` | `#1F7A4D` | Success text/icon/border. |
| `--color-status-success-surface` | `#E7F4EC` | Success badge/alert background. |
| `--color-status-warning` | `#9A6200` | Warning text/icon/border. |
| `--color-status-warning-surface` | `#FDF3DF` | Warning badge/alert background. |
| `--color-status-danger` | `#B32D33` | Danger text/icon/border, destructive buttons. |
| `--color-status-danger-surface` | `#FCEBEC` | Danger badge/alert background. |
| `--color-status-info` | `#0F6E73` | Informational text/icon/border. |
| `--color-status-info-surface` | `#E6F4F4` | Informational badge/alert background. |
| `--color-disabled-surface` | `#ECEFF3` | Disabled control background. |
| `--color-disabled-text` | `#7A8494` | Disabled label/placeholder text. WCAG exempt for disabled controls. |
| `--color-overlay-scrim` | `rgba(17, 24, 39, 0.48)` | Modal/drawer backdrop. |
| `--color-tooltip` | `#1B2230` | Tooltip background. |

**Rule [RECOMMENDATION]:** status colors are never used for branding or decoration. Amber is only warning; red is only danger; green is only success; teal is only information.

### 3.3 Contrast verification — WCAG AA [RECOMMENDATION / VERIFIED CALCULATION]

Ratios calculated with the WCAG relative-luminance formula. AA thresholds: **4.5:1** normal text, **3:1** large text and UI component boundaries/focus indicators.

| Foreground | Background | Ratio | Pass |
|---|---|---:|---|
| `#1B2230` text-primary | `#FFFFFF` surface | 15.93:1 | ✅ AA |
| `#1B2230` | `#F5F6F8` canvas | 14.73:1 | ✅ AA |
| `#1B2230` | `#EEF2FB` primary subtle | 14.21:1 | ✅ AA |
| `#4A5568` text-secondary | `#FFFFFF` | 7.53:1 | ✅ AA |
| `#4A5568` | `#F5F6F8` | 6.96:1 | ✅ AA |
| `#646D7D` text-muted | `#FFFFFF` | 5.22:1 | ✅ AA |
| `#646D7D` | `#F5F6F8` | 4.82:1 | ✅ AA |
| `#FFFFFF` | `#3357A8` primary | 6.84:1 | ✅ AA |
| `#FFFFFF` | `#2A4789` primary hover | 8.89:1 | ✅ AA |
| `#FFFFFF` | `#213A70` primary active | 11.03:1 | ✅ AA |
| `#1F7A4D` success | `#FFFFFF` | 5.32:1 | ✅ AA |
| `#1F7A4D` | `#E7F4EC` | 4.70:1 | ✅ AA |
| `#9A6200` warning | `#FFFFFF` | 5.10:1 | ✅ AA |
| `#9A6200` | `#FDF3DF` | 4.63:1 | ✅ AA |
| `#B32D33` danger | `#FFFFFF` | 6.29:1 | ✅ AA |
| `#B32D33` | `#FCEBEC` | 5.46:1 | ✅ AA |
| `#0F6E73` info | `#FFFFFF` | 6.00:1 | ✅ AA |
| `#0F6E73` | `#E6F4F4` | 5.32:1 | ✅ AA |
| `#3357A8` access-role badge text | `#EEF2FB` | 6.10:1 | ✅ AA |
| `#4A5568` discipline badge text | `#F0F2F5` | 6.71:1 | ✅ AA |
| `#2F6FED` focus ring | `#FFFFFF` | 4.55:1 | ✅ ≥3:1 non-text |
| `#838E9F` border-strong | `#FFFFFF` | 3.31:1 | ✅ ≥3:1 non-text |
| `#838E9F` | `#F5F6F8` | 3.07:1 | ✅ ≥3:1 non-text |
| `#7A8494` disabled text | `#FFFFFF` | 3.78:1 | ⚠️ exempt: disabled controls |

**Notes [RECOMMENDATION]**

- Canvas `#F5F6F8` vs surface `#FFFFFF` is a low-contrast surface distinction and is **decorative only**; structure must also be communicated with borders or spacing.
- Disabled text/button contrast is exempt under WCAG for inactive controls, but labels must never rely on disabled color alone to explain why an action is unavailable.
- Dark mode is **not part of the initial baseline**. The current partial dark query conflicts with hardcoded light classes (Phase 01 UX-16); until tokens are implemented, remove or explicitly park dark mode.

---

## 4. Typography System

### 4.1 Existing configuration [VERIFIED]

- `app/layout.tsx:2-14` already loads **Geist** (`--font-geist-sans`) and **Geist Mono** (`--font-geist-mono`) via `next/font/google`; no new font dependency is needed.
- `app/globals.css:8-13` maps those variables into Tailwind theme keys, but `app/globals.css:25` overrides `body` with `Arial, Helvetica, sans-serif` — this must be corrected to use the Geist variable.
- `app/layout.tsx:16-19` still has default "Create Next App" metadata and `lang="en"` (Phase 01 UX-20).

### 4.2 Recommended type families [RECOMMENDATION]

| Role | Family | Source |
|---|---|---|
| Primary UI font | Geist Sans | Existing `next/font/google` import |
| Monospace | Geist Mono | Existing import; use for IDs, permission keys, JSON, timestamps in code views |
| Fallback | `ui-sans-serif, system-ui, sans-serif` | Browser fallback only |

### 4.3 Type scale [RECOMMENDATION]

| Token | Size / line height | Weight | Letter spacing | Usage |
|---|---|---|---|---|
| `--type-page-title` | 24px / 32px (1.5rem / 2rem) | 600 | -0.01em | Page title (Overview, Projects, Users) |
| `--type-section-title` | 18px / 26px (1.125rem / 1.625rem) | 600 | 0 | Section headers, drawer titles |
| `--type-card-title` | 16px / 24px (1rem / 1.5rem) | 600 | 0 | Card titles, table panel titles |
| `--type-body` | 14px / 22px (0.875rem / 1.375rem) | 400 | 0 | Default body, form values, table cells |
| `--type-body-strong` | 14px / 22px | 500 | 0 | Emphasized values, button labels |
| `--type-helper` | 12px / 18px (0.75rem / 1.125rem) | 400 | 0 | Helper text, captions, timestamps |
| `--type-table-head` | 12px / 16px | 600 | 0.02em | Table column headers |
| `--type-mono` | 12px / 18px | 400 | 0 | Permission keys, IDs, JSON, code |
| `--type-mono-block` | 13px / 20px | 400 | 0 | Audit `before`/`after` blocks |

**Rules [RECOMMENDATION]**

- Default UI text is 14px; do not drop below 12px except mono metadata.
- Use tabular numerals for IDs, counts, dates, and money-like values.
- Do not use uppercase headings as a default; reserve uppercase for the "Status" micro-label if needed.
- Body copy max line length ~80 characters; descriptions max ~64 characters in cards.

---

## 5. Spacing and Layout

### 5.1 Spacing scale [RECOMMENDATION]

4px base scale: `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64` px.
Primary rhythm is 8px. Use 4px only for fine adjustments inside components.

| Token | Value | Typical use |
|---|---|---|
| `--space-1` | 4px | Icon-to-label gap, badge padding |
| `--space-2` | 8px | Input internal gap, tight list rows |
| `--space-3` | 12px | Form field group gap, table cell padding |
| `--space-4` | 16px | Card padding, section inner gap |
| `--space-5` | 20px | Panel padding |
| `--space-6` | 24px | Page padding, major section gap |
| `--space-8` | 32px | Between major content blocks |
| `--space-10` | 40px | Large empty-state spacing |
| `--space-12` | 48px | Rare; page intro separation |

### 5.2 Layout measurements [RECOMMENDATION]

| Element | Measurement |
|---|---|
| Sidebar width (expanded) | 240px |
| Sidebar width (collapsed, future) | 64px icon rail |
| Mobile sidebar overlay | 280px max |
| Topbar height | 56px |
| Page padding (desktop) | 24px |
| Page padding (tablet) | 16px |
| Page padding (mobile) | 12px |
| Content max width | 1280px for management/list pages |
| Narrow content max width | 760px for single-column forms/detail |
| Card padding | 16px default, 20px for summary panels |
| Section spacing | 24px between major sections |
| Component gap | 8–12px |

### 5.3 Breakpoint guidance [RECOMMENDATION]

| Range | Layout |
|---|---|
| ≥1280px | Full shell, 240px sidebar, dense tables, optional 2-column detail layouts. |
| 1024–1279px | Full shell, content max 1280 but no extra side panels. |
| 768–1023px | Sidebar collapses to icon rail or menu button; tables scroll horizontally. |
| <768px | Sidebar becomes overlay drawer; topbar keeps page/breadcrumb context; forms become full-width stacked. |

**Constraint [CONSTRAINT]:** support Phase 02 areas only — Overview, Projects, Team, Access Management, Activity / Audit. Do not design layouts for postponed modules.

---

## 6. Shape and Elevation

### 6.1 Radius scale [RECOMMENDATION]

| Token | Value | Use |
|---|---|---|
| `--radius-none` | 0px | Table cells, dividers |
| `--radius-sm` | 4px | Buttons, inputs, badges, checkboxes |
| `--radius-md` | 6px | Cards, panels, inline alerts |
| `--radius-lg` | 8px | Modal, drawer, toast |
| `--radius-full` | 999px | Only status dots, never main containers |

**Rule:** avoid >8px radius on large surfaces. No pill-shaped cards.

### 6.2 Borders [RECOMMENDATION]

- Default border: `1px solid var(--color-border-subtle)` for cards/panels.
- Interactive border: `1px solid var(--color-border-strong)` for inputs and secondary buttons.
- Error border: `1px solid var(--color-status-danger)`.
- No double borders; table rows use `--color-divider` only.

### 6.3 Elevation [RECOMMENDATION]

| Level | Shadow | Use |
|---|---|---|
| `--shadow-none` | none | Default cards and tables |
| `--shadow-1` | `0 1px 2px rgba(27,34,48,0.06)` | Dropdown, popover, sticky header |
| `--shadow-2` | `0 8px 24px rgba(27,34,48,0.12)` | Modal, drawer |
| `--shadow-toast` | `0 4px 12px rgba(27,34,48,0.10)` | Toast only |

No colored glows, no layered ambient shadows.

### 6.4 Focus ring [RECOMMENDATION]

- `2px solid var(--color-interactive-focus)` with `2px offset`.
- On overlay scrim, use `2px solid #FFFFFF` inner ring plus the blue outer ring.
- Never remove focus outline without replacement.

---

## 7. Iconography

### 7.1 Current state [VERIFIED]

- No icon library is installed (`auth-frontend/package.json:11-25`).
- Current UI uses text labels and underline text actions; `public/*.svg` are unused Next.js starter assets.
- The mobile menu button uses a text label "Menu" with `aria-label` (Phase 01).

### 7.2 Recommendation [RECOMMENDATION]

| Rule | Specification |
|---|---|
| Style | Inline SVG only, 1.5px stroke, `currentColor`, round caps/joins. |
| Size | 16px default action/nav-inline; 20px primary nav; 12px status/badge. |
| Placement | Icon before label in buttons/nav; 8px gap. Icon-only buttons require `aria-label` and tooltip. |
| Navigation | Icons are optional support; text label always visible. Do not rely on icon meaning alone. |
| Actions | Use icons sparingly (edit, delete, add, refresh, filter). Prefer text labels in dense admin tables. |
| Status | Shape + color + text; never color alone. |
| Dependency | No new icon package; curate a small inline SVG set when implementing Phase 04. |

**Anti-pattern:** decorative emoji or gaming-style glyphs as functional UI.

---

## 8. Component Specifications

Common state definitions used by all components:

| State | Visual rule |
|---|---|
| Default | Base surface, border, and text tokens. |
| Hover | One-step darker surface or tint; no scale transform. |
| Focus | 2px blue focus ring with 2px offset. |
| Active / selected | Primary tint background or 2px primary indicator; weight 600 for text. |
| Disabled | `--color-disabled-surface`, `--color-disabled-text`, `cursor: not-allowed`; no hover change. |
| Loading | Spinner or skeleton; keep label; disable interaction; preserve control width. |
| Error | Danger border + danger helper text; never color alone. |

### 8.1 Buttons

| Variant | Visual | Use |
|---|---|---|
| Primary | `#3357A8` bg, `#FFFFFF` text, radius 4 | Main submit / create action |
| Secondary | White bg, `#838E9F` border, `#4A5568` text | Cancel, alternate action |
| Ghost | Transparent, hover `#EDF1FA` | Toolbar low-emphasis actions |
| Danger | `#B32D33` bg, white text | Destructive confirm only |
| Link | Primary text, underline on hover | Inline navigation, table row actions |

| Size | Height | Padding |
|---|---|---|
| sm | 32px | 8px 12px |
| md (default) | 36px | 8px 16px |
| lg | 40px | 10px 20px |

**Rules:** one Primary button per view; Danger requires confirmation; loading keeps the label and adds a spinner; disabled buttons explain why via nearby text if needed.

### 8.2 Inputs and textareas

- Height 36px (sm) / 40px (md); textarea min-height 80px.
- Border `--color-border-strong`; bg white; text primary; placeholder muted.
- Focus ring blue; error border danger + 12px helper message below.
- Disabled bg `--color-disabled-surface`.
- Every input has a persistent visible label (fixes Phase 01 UX-06).
- Inline validation messages, not one global toast (Phase 01 UX-07).

### 8.3 Select and dropdown

- Native `<select>` is acceptable for MVP; custom listbox only if needed later.
- Same sizing/border/focus as input; chevron 16px `currentColor`.
- Option hover `#EEF2FB`; selected option shows check + primary text.
- If loading options, show inline skeleton and disable save (Phase 01 UX-18).

### 8.4 Checkbox and radio

- 16px control, radius 4 for checkbox, full for radio.
- Unchecked border `--color-border-strong`; checked bg primary with white check/dot.
- Label 14px, 8px gap; focus ring on control; disabled per common state.
- Use for role/permission pickers; never use a toggle switch for non-binary settings.

### 8.5 Badges and status indicators

| Badge type | Visual | Meaning |
|---|---|---|
| **Studio Discipline** | bg `#F0F2F5`, border `#C9CFD8`, text `#4A5568`, radius 4 | Discipline only: Developer, Designer, Artist, QA |
| **Access Role** | bg `#EEF2FB`, border `#C9D6F0`, text `#3357A8`, radius 4 | RBAC access role: Administrator/Editor/Viewer today superadmin/Editor/Penulis |
| **Status – success** | bg `#E7F4EC`, text `#1F7A4D` | Active, valid, completed |
| **Status – warning** | bg `#FDF3DF`, text `#9A6200` | Expiring soon, inactive, needs attention |
| **Status – danger** | bg `#FCEBEC`, text `#B32D33` | Revoked, expired, error |
| **Status – info** | bg `#E6F4F4`, text `#0F6E73` | Neutral informational state |

**Rule [CONSTRAINT]:** Discipline badges are neutral, Access Role badges are blue-tinted, Status badges are semantic. They must never be visually interchangeable.

### 8.6 Cards and summary panels

- White surface, 1px `--color-border-subtle`, radius 6, padding 16–20, no shadow.
- Header 16px/600, body 14px, meta 12px muted.
- Use for Overview summary tiles and Project detail sections.
- Avoid card-inside-card; use dividers instead.

### 8.7 Tables and pagination

- Header row bg `--color-canvas`, text 12px/600 secondary, sticky on scroll.
- Row min-height 40px; cell padding 12px; divider `--color-divider`.
- Row hover `--color-canvas`; selected row `--color-brand-primary-subtle`.
- Numeric and ID cells use Geist Mono with tabular numerals.
- Action column right-aligned; max 3 visible actions, overflow menu later.
- Pagination: 32px buttons, current page primary tint, "Previous/Next" labels plus page numbers (Phase 01 UX-17).

### 8.8 Modal and confirmation dialog

- Scrim `--color-overlay-scrim`; panel white, radius 8, shadow-2, width 420px (max 90vw).
- Title 18px/600; body 14px secondary; actions right-aligned, Cancel secondary, Confirm Danger for destructive.
- Focus trap, Escape to close, focus returns to trigger.
- Used for delete/revoke confirmation across all pages (fixes Phase 01 UX-08).

### 8.9 Drawers

- Right-side panel width 480px, 720px on ≥1280px; full width on mobile.
- Scrim same as modal; shadow-2; header with title + close; body scrollable; footer with primary/secondary actions.
- Used for create/edit forms to preserve list context (fixes Phase 01 UX-04).

### 8.10 Toast and alerts

- Toast top-right, max-width 360px, radius 6, shadow-toast, 16px padding.
- Left 4px accent stripe: success/warning/danger/info; default info for neutral success.
- Auto-dismiss 5s; manual close with `aria-label`.
- Error toast uses `role="alert"`; others `role="status"` (fixes Phase 01 UX-21).
- Inline alerts use surface tint + 12px text + optional action.

### 8.11 Tabs and breadcrumbs

- Tabs: bottom border 2px transparent; active border primary + text primary 600; inactive text secondary; hover text primary.
- Breadcrumbs: 12px muted, `/` separator, current page primary 500; driven by navigation registry (fixes Phase 01 UX-22).

### 8.12 Loading, empty, and error states

| State | Treatment |
|---|---|
| Loading | Skeleton blocks in `--color-surface-subtle`; or 16px spinner + "Memuat...". Keep layout stable. |
| Empty | Centered short text, optional illustration-free icon 20px, CTA only if user has permission. |
| Error | Danger-tinted inline panel with short message and Retry button; details collapsed. |

Use one shared set globally (fixes Phase 01 UX-11, UX-24).

---

## 9. Interaction States

### 9.1 Focus and keyboard [RECOMMENDATION]

- Visible focus ring on every interactive element (§6.4).
- Tab order follows DOM order: sidebar → topbar → breadcrumb → page actions → content → pagination.
- Modal/drawer traps focus; Escape closes; focus returns to trigger.
- Native controls preferred so keyboard behavior is free.

### 9.2 Disabled states [RECOMMENDATION]

- Disabled controls are not focusable by default; if focus is needed for explanation, use `aria-disabled` with helper text.
- Never use disabled styling for "no permission" when the real reason is backend denial; hide the action or show a clear explanation.

### 9.3 Form validation [RECOMMENDATION]

- Validate on submit and on blur after first submit.
- Field-level message below control, 12px danger text + danger border.
- Summary line at top: "Periksa 2 field" with anchors to fields.
- Keep user input; never clear form on error.

### 9.4 Destructive action confirmation [RECOMMENDATION]

- Confirmation dialog states object name and consequence ("role will be replaced", "descendants will be revoked").
- Confirm button label is specific: "Ya, hapus", not just "Ya".
- Danger variant only for irreversible actions; revoke/deactivate may use warning if reversible.

### 9.5 Loading feedback [RECOMMENDATION]

- Buttons: spinner + retained label, disabled during request.
- Lists: skeleton rows matching final row height.
- Drawer: form remains visible; footer shows saving state.
- Never show only a full-page spinner after user has interacted.

### 9.6 Motion [RECOMMENDATION]

| Property | Value |
|---|---|
| Duration | 120–180ms |
| Easing | `cubic-bezier(0.2, 0, 0.2, 1)` (ease-out) |
| Used for | Hover color, drawer slide, scrim fade, toast enter |
| Avoided for | Bounce, scale, rotation, parallax, decorative delays |

**Reduced motion:** when `prefers-reduced-motion: reduce`, set duration to 0ms and remove transforms; state changes still occur instantly.

### 9.7 Minimum practical target sizes [RECOMMENDATION]

- Standard control height: 36px.
- Dense table action target: at least 32×32px hit area even if visual text is smaller.
- Icon-only button: 32×32px with `aria-label`.
- Checkbox/radio visual 16px with 32px clickable label area.

---

## 10. Accessibility Guidelines

**Contrast:** all text pairings listed in §3.3 meet WCAG AA. UI boundaries use `#838E9F` where identification matters.

**Additional requirements [RECOMMENDATION]**

1. Visible labels for all form fields; placeholders are hints only.
2. Error messages connected with `aria-describedby`; invalid fields marked `aria-invalid`.
3. `role="alert"` for errors, `role="status"` for success/neutral.
4. Focus not trapped except in modal/drawer.
5. Status conveyed by text + shape + color, not color alone.
6. Set document language to Indonesian and update metadata (Phase 01 UX-20).
7. Respect reduced-motion.
8. Maintain heading order: one H1 per page, H2 for sections, H3 for subsections.
9. Tables use proper `<th scope="col">` and caption where needed.
10. Skeleton and spinner states include `aria-busy` and accessible text.

**Known constraint [VERIFIED]:** token stored in `localStorage`; this is not a visual-system issue but must stay documented (Phase 01 §4.10).

---

## 11. Responsive Design Principles

- Desktop-first baseline at ≥1024px: 240px sidebar + 56px topbar + 1280px content.
- At 768–1023px: sidebar becomes icon rail or menu button; page padding 16px.
- At <768px: sidebar overlay, stacked forms, topbar shows breadcrumb/project context, tables scroll horizontally.
- Do not collapse tables into card lists in MVP; horizontal scroll is more predictable for dense admin data.
- Drawers become full-screen on mobile; modals capped at 90vw.
- Badges wrap; action columns remain right-aligned but may wrap under the row label on narrow screens.
- Touch targets remain ≥32px even in dense views.

---

## 12. Design Token Reference

| Token group | Tokens |
|---|---|
| Brand | `--color-brand-primary`, `-hover`, `-active`, `-subtle`, `-subtle-hover`, `--color-brand-secondary`, `--color-brand-secondary-subtle` |
| Surface | `--color-canvas`, `--color-surface`, `--color-surface-subtle` |
| Border | `--color-border-subtle`, `--color-border-strong`, `--color-border-discipline`, `--color-border-access`, `--color-divider` |
| Text | `--color-text-primary`, `-secondary`, `-muted`, `-on-brand` |
| Interactive | `--color-interactive-focus`, `--color-interactive-hover` |
| Status | `--color-status-success`, `-success-surface`, `-warning`, `-warning-surface`, `-danger`, `-danger-surface`, `-info`, `-info-surface` |
| Disabled/overlay | `--color-disabled-surface`, `--color-disabled-text`, `--color-overlay-scrim`, `--color-tooltip` |
| Type | `--type-page-title`, `--type-section-title`, `--type-card-title`, `--type-body`, `--type-body-strong`, `--type-helper`, `--type-table-head`, `--type-mono`, `--type-mono-block` |
| Space | `--space-1` … `--space-12` (see §5.1) |
| Radius | `--radius-none`, `-sm`, `-md`, `-lg`, `-full` |
| Shadow | `--shadow-none`, `-1`, `-2`, `-toast` |
| Motion | `--motion-duration-fast: 120ms`, `--motion-duration: 160ms`, `--motion-ease: cubic-bezier(0.2,0,0.2,1)` |
| Layout | `--layout-sidebar: 240px`, `--layout-sidebar-collapsed: 64px`, `--layout-topbar: 56px`, `--layout-content-max: 1280px` |

**Implementation note [RECOMMENDATION]:** map these tokens into Tailwind 4 `@theme` when Phase 04 begins. Do not create the config in this phase.

---

## 13. Usage Rules and Anti-patterns

### 13.1 Usage rules [RECOMMENDATION]

1. One primary action per page.
2. Use surface + border before shadow.
3. Use badge type consistently: neutral = discipline, blue = access role, semantic = status.
4. Use mono font for machine-generated strings (IDs, keys, JSON).
5. Keep table density high but add 12px cell padding and clear row hover.
6. Use drawers for create/edit; modal only for confirmation/short choices.
7. Show inline validation; reserve toasts for operation outcomes.
8. Derive breadcrumbs and nav visibility from the single navigation registry.
9. Treat project context as visual context, never as authorization.
10. Keep Access Role separate from Studio Discipline in labels, badges, and copy.

### 13.2 Anti-patterns [RECOMMENDATION]

- Multiple primary buttons competing on one screen.
- Card-inside-card nesting; excessive 12px+ radii.
- Gradients, neon accents, RGB/gaming aesthetics.
- Using amber for "selected" or red for "active".
- Color-only status or disabled explanation.
- Placeholder-only labels.
- Full-page spinners after user action.
- Hiding a link and assuming the endpoint is protected.
- Designing modules not in Phase 02 (Assets/Tasks/Settings) as if they exist.
- Adding icon/font dependencies not already present.

---

## 14. Traceability to Phase 01 UX Findings

| Phase 01 ID | Phase 03 response |
|---|---|
| UX-01 | §9 Global shell assumption; §5 layout; §7 nav icon rules |
| UX-02 | §13 usage rule 8; single navigation registry referenced in §9 |
| UX-03 | §13 rule 8; badge/nav separation; no dynamic-vs-static swap in design |
| UX-04 | §8.9 Drawers for create/edit |
| UX-05 | §8.8/8.9 one overlay at a time; focus trap |
| UX-06 | §8.2 visible labels; §10 rule 1 |
| UX-07 | §9.3 inline validation |
| UX-08 | §8.8 shared confirmation dialog |
| UX-09 | §8.10 shared toast/alerts; §13 rule 7 |
| UX-10 | §4 Constraint; §9.2 backend authority; no UI-only authorization |
| UX-11 | §8.12 shared loading/empty/error |
| UX-12 | §8.2 helper text; §9.3 validation |
| UX-13 | §8.7 mono tabular IDs/emails; §4 mono usage |
| UX-14 | §8.5/§8.7 tree-friendly tables; no specific tree widget in MVP |
| UX-15 | §13 rule 9; project/visibility as visual context only |
| UX-16 | §3.3 note; light-mode baseline only until tokenized dark mode |
| UX-17 | §8.7 pagination with page numbers |
| UX-18 | §8.3 loading options + disable save; §9.3 validation |
| UX-19 | §4 mono/code treatment for `action:resource`, `resource.action` |
| UX-20 | §4.1 metadata/lang note; §10 rule 6 |
| UX-21 | §8.10 role="alert" for errors |
| UX-22 | §8.11 breadcrumbs from navigation registry |
| UX-23 | §7 icon + text action buttons; §8.1 sizes |
| UX-24 | §8.12 empty state CTA only when permitted |

---

## 15. Readiness Checklist for Phase 04

Before wireframing begins, confirm:

- [ ] Palette and contrast table in §3.3 approved.
- [ ] Geist Sans/Mono accepted as the only typefaces; `body` font override correction accepted.
- [ ] Type scale, spacing scale, and layout measurements accepted.
- [ ] Radius/shadow limits accepted (no pill cards, no colored glows).
- [ ] Icon approach accepted (inline SVG, no new dependency).
- [ ] Component variant tables accepted.
- [ ] Discipline / Access Role / Status badge treatments accepted as distinct.
- [ ] Drawer-for-forms and modal-for-confirmation decisions accepted.
- [ ] Inline validation and shared state components accepted.
- [ ] Focus ring, keyboard rules, reduced-motion, and target sizes accepted.
- [ ] Light mode only for MVP confirmed.
- [ ] Document language and metadata correction acknowledged.
- [ ] Navigation registry from Phase 02 confirmed as source of truth for nav/breadcrumbs.
- [ ] Project context defined as visual only, not authorization.
- [ ] No postponed module (Assets, Tasks, Settings) appears in wireframes.

**Phase 04 should produce wireframes and page templates only after every checkbox above is accepted. No implementation starts in Phase 04.**

---

**STOP — Phase 03 complete. Awaiting review before wireframes/design.**
