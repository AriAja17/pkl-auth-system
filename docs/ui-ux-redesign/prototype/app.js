/* Studio Management — standalone design prototype.
   No backend, no API, no dependencies. Mock data + local state only. */

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Mock data
  // ---------------------------------------------------------------------
  const roles = [
    { id: "r-sys", name: "superadmin", isSystem: true },
    { id: "r-ed", name: "Editor", isSystem: false },
    { id: "r-wr", name: "Penulis", isSystem: false },
    { id: "r-qa", name: "QA Lead", isSystem: false }, // dynamic role example
  ];

  const permissions = [
    { id: "p1", key: "read:user", isProtected: false },
    { id: "p2", key: "create:user", isProtected: false },
    { id: "p3", key: "update:user", isProtected: false },
    { id: "p4", key: "read:role", isProtected: false },
    { id: "p5", key: "update:role", isProtected: false },
    { id: "p6", key: "read:permission", isProtected: false },
    { id: "p7", key: "read:menu", isProtected: false },
    { id: "p8", key: "update:menu", isProtected: false },
    { id: "p9", key: "read:delegation", isProtected: false },
    { id: "p10", key: "create:delegation", isProtected: false },
    { id: "p11", key: "delete:delegation", isProtected: false },
    { id: "p12", key: "read:audit", isProtected: false },
    { id: "p13", key: "read:article", isProtected: false },
    { id: "p14", key: "manage:user", isProtected: true },
    { id: "p15", key: "grant:admin", isProtected: true },
  ];

  const users = [
    { id: "u-self", username: "ari", email: "ari@studio.local", name: "Ari", phone: null, isActive: true, roleIds: ["r-sys"] },
    { id: "u-2", username: "nadia", email: "nadia@studio.local", name: "Nadia", phone: "0812345678", isActive: true, roleIds: ["r-ed"] },
    { id: "u-3", username: "rio", email: "rio@studio.local", name: "Rio", phone: null, isActive: true, roleIds: ["r-wr", "r-qa"] },
    { id: "u-4", username: "sari", email: "sari@studio.local", name: "Sari", phone: null, isActive: false, roleIds: ["r-ed"] },
  ];

  const rolePermissions = {
    "r-sys": permissions.map((p) => p.id),
    "r-ed": ["p1", "p13"],
    "r-wr": ["p13"],
    "r-qa": ["p1", "p12"],
  };

  const menuItems = [
    { id: "m1", name: "Overview", url: "/dashboard", icon: "", parentId: null, order: 1, description: "Ringkasan workspace", isActive: true, permissionIds: ["p1"] },
    { id: "m2", name: "Access", url: "", icon: "", parentId: null, order: 2, description: "Grup administrasi akses", isActive: true, permissionIds: [] },
    { id: "m3", name: "Users", url: "/admin/users", icon: "", parentId: "m2", order: 1, description: "Kelola akun", isActive: true, permissionIds: ["p1"] },
    { id: "m4", name: "Activity", url: "/admin/audit-logs", icon: "", parentId: "m2", order: 2, description: "Audit log", isActive: true, permissionIds: ["p12"] },
  ];

  const delegations = [
    { id: "d1", granteeId: "u-2", permissionKey: "read:user", grantedBy: "u-self", parentCapabilityId: null, expiresAt: daysFromNow(12), valid: true },
    { id: "d2", granteeId: "u-3", permissionKey: "read:audit", grantedBy: "u-self", parentCapabilityId: null, expiresAt: daysFromNow(40), valid: true },
    { id: "d3", granteeId: "u-4", permissionKey: "update:menu", grantedBy: "u-self", parentCapabilityId: null, expiresAt: daysFromNow(-2), valid: false },
  ];

  const projects = [
    { id: "pr1", name: "Harbor Runner", status: "In progress", members: 4, updated: "2026-11-18" },
    { id: "pr2", name: "Pixel Garden", status: "Prototype", members: 2, updated: "2026-11-15" },
    { id: "pr3", name: "Dungeon Loop", status: "Planning", members: 3, updated: "2026-11-10" },
  ];

  const audit = [
    { id: "a1", actor: "ari@studio.local", action: "user.create", resourceType: "user", resourceId: "u-4", createdAt: "2026-11-19T09:12:00", before: null, after: { id: "u-4", email: "sari@studio.local", isActive: true, roleIds: ["r-ed"] } },
    { id: "a2", actor: "ari@studio.local", action: "role.permissions.update", resourceType: "role", resourceId: "r-ed", createdAt: "2026-11-18T14:30:00", before: { permissionKeys: ["read:article"] }, after: { permissionKeys: ["read:article", "read:user"] } },
    { id: "a3", actor: "nadia@studio.local", action: "delegation.revoke", resourceType: "delegation", resourceId: "d3", createdAt: "2026-11-17T11:05:00", before: { permissionKey: "update:menu" }, after: { invalidatedDescendantIds: [] } },
  ];

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const state = {
    screen: "login",
    currentUser: null,
    catalogFailure: false,
    actorIsSystem: true,
    authError: "",
    registerSuccess: false,
    loadingScreen: null,
    visited: {},
    activityFilters: { action: "", resourceType: "", actorId: "", resourceId: "", from: "", to: "" },
    pendingConfirm: null,
    focusStack: [],
  };

  const DATA_SCREENS = ["projects", "project-detail", "team", "users", "roles", "permissions", "menus", "delegations", "activity"];

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 16);
  }
  function localInput(offsetMinutes) {
    const d = new Date(Date.now() + offsetMinutes * 60000);
    const pad = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function roleById(id) { return roles.find((r) => r.id === id); }
  function roleName(id) { const r = roleById(id); return r ? r.name : id; }
  function currentRoleIds() { return state.currentUser ? state.currentUser.roleIds : []; }
  function isSystemActor() { return currentRoleIds().some((id) => roleById(id) && roleById(id).isSystem); }
  function currentPermissions() {
    const set = new Set();
    currentRoleIds().forEach((id) => (rolePermissions[id] || []).forEach((pid) => set.add(pid)));
    return set;
  }
  function hasPermission(key) {
    if (isSystemActor()) return true;
    const perm = permissions.find((p) => p.key === key);
    return Boolean(perm && currentPermissions().has(perm.id));
  }
  function accessBadges(ids) {
    return (ids || []).map((id) => `<span class="badge badge-access">${esc(roleName(id))}</span>`).join(" ");
  }
  function statusBadge(value) {
    if (value === true || value === "Aktif" || value === "In progress") return `<span class="badge badge-success">${esc(value === true ? "Aktif" : value)}</span>`;
    if (value === false || value === "Nonaktif" || value === "tidak valid") return `<span class="badge badge-danger">${esc(value === false ? "Nonaktif" : value)}</span>`;
    return `<span class="badge badge-warning">${esc(value)}</span>`;
  }
  function plannedBadge() { return '<span class="badge badge-info">PLANNED</span>'; }
  function pageHeader(title, subtitle, actions) {
    return `<div class="page-header"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${actions ? `<div class="header-actions">${actions}</div>` : ""}</div>`;
  }
  function emptyState(text, mark) {
    return `<div class="empty-state"><div class="empty-mark">${mark || "○"}</div>${esc(text)}</div>`;
  }
  function skeletonRows(count) {
    return `<div class="table-scroll"><div>${Array.from({ length: count }, () => '<div class="skeleton-row"></div>').join("")}</div></div>`;
  }
  function field(label, name, value, opts) {
    opts = opts || {};
    const disabled = opts.disabled ? " disabled" : "";
    const invalid = opts.invalid ? ' aria-invalid="true"' : "";
    const type = opts.type || "text";
    const minmax = opts.min ? ` min="${esc(opts.min)}" max="${esc(opts.max)}"` : "";
    let control;
    if (opts.textarea) {
      control = `<textarea id="f-${name}" name="${name}"${disabled}>${esc(value || "")}</textarea>`;
    } else if (opts.select) {
      control = `<select id="f-${name}" name="${name}"${disabled}>${opts.options || ""}</select>`;
    } else {
      control = `<input id="f-${name}" type="${type}" name="${name}" value="${esc(value || "")}"${disabled}${invalid}${minmax} placeholder="${esc(opts.placeholder || "")}" />`;
    }
    return `<div class="field${opts.full ? " full" : ""}"><label for="f-${name}">${esc(label)}</label>${control}<span class="field-error">${esc(opts.error || "")}</span></div>`;
  }

  // ---------------------------------------------------------------------
  // Toast, drawer, modal
  // ---------------------------------------------------------------------
  function showToast(message, type) {
    type = type || "info";
    const persistent = type === "error"; // Phase 04 adjustment ADJ-02
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.innerHTML = `<div><strong>${type === "error" ? "Gagal" : type === "success" ? "Berhasil" : "Info"}</strong><div>${esc(message)}</div></div><button type="button" aria-label="Tutup notifikasi" data-action="dismiss-toast">×</button>`;
    $("toast-root").appendChild(el);
    if (!persistent) setTimeout(() => el.remove(), 5000);
  }

  function focusables(container) {
    return Array.from(container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'));
  }
  function pushFocus() {
    const active = document.activeElement;
    state.focusStack.push(active && active.focus ? active : document.body);
  }
  function popFocus() {
    const previous = state.focusStack.pop();
    if (previous && previous.focus && previous !== document.body) previous.focus();
  }
  function openOverlay(rootId, html, focusSelector) {
    const root = $(rootId);
    if (!root.firstElementChild) pushFocus();
    root.innerHTML = html;
    const container = root.firstElementChild;
    if (container) {
      const target = focusSelector ? container.querySelector(focusSelector) : null;
      const first = target || focusables(container)[0];
      if (first) first.focus();
    }
  }
  function openDrawer(title, body, footer, wide) {
    openOverlay("drawer-root", `
      <section class="drawer${wide ? " drawer-wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="drawer-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-action="close-drawer" aria-label="Tutup">×</button></div>
        <div class="drawer-body">${body}</div>
        <div class="drawer-foot">${footer || '<button class="btn btn-secondary" data-action="close-drawer">Tutup</button>'}</div>
      </section>`, '[data-action="close-drawer"]');
  }
  function closeDrawer() { $("drawer-root").innerHTML = ""; popFocus(); }
  function openModal(config) {
    state.pendingConfirm = config.onConfirm || null;
    openOverlay("modal-root", `
      <div class="modal-scrim" data-action="close-modal">
        <section class="modal" role="alertdialog" aria-modal="true" aria-label="${esc(config.title)}">
          <h2>${esc(config.title)}</h2><p>${esc(config.text)}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-action="close-modal">Batal</button>
            <button class="btn ${config.danger ? "btn-danger" : "btn-primary"}" data-action="confirm-yes">${esc(config.confirmLabel || "Ya")}</button>
          </div>
        </section>
      </div>`);
  }
  function closeModal() { $("modal-root").innerHTML = ""; state.pendingConfirm = null; popFocus(); }

  // ---------------------------------------------------------------------
  // Navigation & shell rendering
  // ---------------------------------------------------------------------
  const NAV = [
    { group: "Studio", items: [
      { screen: "overview", label: "Overview" },
      { screen: "projects", label: "Projects", planned: true },
    ] },
    { group: "Prototype concepts", items: [
      { screen: "team", label: "Team", planned: true },
    ] },
    { group: "Access & Activity", items: [
      { screen: "users", label: "Users", perm: "read:user" },
      { screen: "roles", label: "Roles", perm: "read:role" },
      { screen: "permissions", label: "Permissions", perm: "read:permission" },
      { screen: "menus", label: "Menus", perm: "read:menu" },
      { screen: "delegations", label: "Delegations", perm: "read:delegation" },
      { screen: "activity", label: "Activity", perm: "read:audit" },
    ] },
  ];

  function navigate(screen, params) {
    state.screen = screen;
    state.params = params || {};
    closeDrawer(); closeModal();
    if (DATA_SCREENS.indexOf(screen) !== -1 && !state.visited[screen]) {
      state.visited[screen] = true;
      state.loadingScreen = screen;
      setTimeout(() => { if (state.loadingScreen === screen) { state.loadingScreen = null; render(); } }, 360);
    }
    render();
    window.scrollTo({ top: 0 });
  }

  function renderSidebar() {
    const system = isSystemActor();
    let html = "";
    NAV.forEach((group) => {
      const items = group.items.filter((item) => !item.perm || hasPermission(item.perm));
      if (!items.length) return; // hide empty groups
      html += `<div class="nav-group"><p class="nav-group-title">${esc(group.group)}</p>`;
      items.forEach((item) => {
        const active = state.screen === item.screen ? " active" : "";
        html += `<button class="nav-item${active}" data-nav="${item.screen}" type="button"><span>${esc(item.label)}</span>${item.planned ? `<span class="tag">${plannedBadge()}</span>` : ""}</button>`;
      });
      html += "</div>";
    });
    $("sidebar").innerHTML = html;
  }

  const BREADCRUMBS = {
    overview: ["Overview"], projects: ["Projects"], "project-detail": ["Projects", "Project detail"],
    team: ["Team"], users: ["Access Management", "Users"], roles: ["Access Management", "Roles"],
    permissions: ["Access Management", "Permissions"], menus: ["Access Management", "Menus"],
    delegations: ["Access Management", "Delegations"], activity: ["Activity"],
  };
  function renderBreadcrumb() {
    const trail = BREADCRUMBS[state.screen] || [];
    $("breadcrumb").innerHTML = `<span>Workspace</span>${trail.map((t, i) => `<span>/</span><span class="${i === trail.length - 1 ? "current" : ""}">${esc(t)}</span>`).join("")}`;
  }

  function render() { renderShell(); }

  function renderShell() {
    const loggedIn = Boolean(state.currentUser);
    $("auth-root").hidden = loggedIn;
    $("app-root").hidden = !loggedIn;
    if (!loggedIn) { renderAuth(); return; }
    $("profile-name").textContent = state.currentUser.name;
    $("profile-avatar").textContent = (state.currentUser.name || "U").slice(0, 1).toUpperCase();
    $("profile-email").textContent = state.currentUser.email;
    $("profile-roles").innerHTML = accessBadges(currentRoleIds());
    const catalogBtn = $("toggle-catalog");
    catalogBtn.setAttribute("aria-pressed", String(state.catalogFailure));
    catalogBtn.textContent = state.catalogFailure ? "Katalog: GAGAL" : "Simulasikan katalog gagal";
    const actorBtn = $("toggle-actor");
    actorBtn.setAttribute("aria-pressed", String(!state.actorIsSystem));
    actorBtn.textContent = isSystemActor() ? "Actor: superadmin" : "Actor: Editor";
    renderSidebar();
    renderBreadcrumb();
    renderPage();
  }

  // ---------------------------------------------------------------------
  // Authentication screens
  // ---------------------------------------------------------------------
  function renderAuth() {
    if (state.screen === "register") { renderRegister(); return; }
    $("auth-root").innerHTML = `
      <main class="auth-page"><section class="auth-card">
        <h1>Studio Management</h1>
        <p class="auth-sub">Masuk ke workspace untuk melanjutkan.</p>
        <form data-form="login" novalidate>
          ${field("Email", "email", "", { type: "email", placeholder: "nama@studio.local", full: true })}
          ${field("Password", "password", "", { type: "password", placeholder: "Minimal 6 karakter", full: true })}
          ${state.authError ? `<div class="alert alert-danger" role="alert"><strong>Gagal.</strong><span>${esc(state.authError)}</span></div>` : ""}
          <button class="btn btn-primary" type="submit" style="width:100%">Login</button>
        </form>
        <a class="auth-link" href="#" data-nav="register">Belum punya akun? Daftar</a>
      </section></main>`;
  }

  function renderRegister() {
    $("auth-root").innerHTML = `
      <main class="auth-page"><section class="auth-card">
        <h1>Daftar</h1>
        <p class="auth-sub">Akun baru belum punya akses sampai admin memberi role.</p>
        ${state.registerSuccess ? `
          <div class="alert alert-success" role="status"><strong>Berhasil.</strong><span>Akun dibuat. Silakan login dan minta admin memberi role.</span></div>
          <a class="auth-link" href="#" data-nav="login">Ke halaman login</a>` : `
          <form data-form="register" novalidate>
            ${field("Email", "email", "", { type: "email", placeholder: "nama@studio.local", full: true })}
            ${field("Username (opsional)", "username", "", { placeholder: "3-30 karakter [a-z0-9_]", full: true })}
            ${field("Password", "password", "", { type: "password", placeholder: "Minimal 6 karakter", full: true })}
            ${state.authError ? `<div class="alert alert-danger" role="alert"><strong>Gagal.</strong><span>${esc(state.authError)}</span></div>` : ""}
            <button class="btn btn-primary" type="submit" style="width:100%">Daftar</button>
          </form>
          <a class="auth-link" href="#" data-nav="login">Sudah punya akun? Login</a>`}
      </section></main>`;
  }

  // ---------------------------------------------------------------------
  // Page renderer
  // ---------------------------------------------------------------------
  function renderPage() {
    const root = $("page-root");
    if (state.loadingScreen === state.screen) {
      root.innerHTML = pageHeader(state.screen.replace("-", " "), "Memuat data...", "") + skeletonRows(5);
      return;
    }
    switch (state.screen) {
      case "overview": root.innerHTML = renderOverview(); break;
      case "projects": root.innerHTML = renderProjects(); break;
      case "project-detail": root.innerHTML = renderProjectDetail(); break;
      case "team": root.innerHTML = renderTeam(); break;
      case "users": root.innerHTML = renderUsers(); break;
      case "roles": root.innerHTML = renderRoles(); break;
      case "permissions": root.innerHTML = renderPermissions(); break;
      case "menus": root.innerHTML = renderMenus(); break;
      case "delegations": root.innerHTML = renderDelegations(); break;
      case "activity": root.innerHTML = renderActivity(); break;
      default: root.innerHTML = renderOverview();
    }
  }

  function renderOverview() {
    const recent = audit.slice(0, 5).map((a) => `
      <tr>
        <td class="mono muted">${esc(a.createdAt.replace("T", " "))}</td>
        <td class="mono">${esc(a.action)}</td>
        <td>${esc(a.resourceType)} <span class="mono muted">${esc(a.resourceId)}</span></td>
        <td>${esc(a.actor)}</td>
        <td class="actions-cell"><button class="link-btn" data-action="view-audit" data-id="${a.id}">Lihat</button></td>
      </tr>`).join("");
    const actions = [];
    if (hasPermission("read:user") || hasPermission("read:role")) actions.push('<button class="btn btn-secondary" data-nav="users">Kelola akses</button>');
    if (hasPermission("read:audit")) actions.push('<button class="btn btn-secondary" data-nav="activity">Lihat aktivitas</button>');
    return `
      ${pageHeader("Overview", "Ringkasan workspace dan akses Anda.", "")}
      <section class="content-block">
        <h2>Selamat datang, ${esc(state.currentUser.name)}</h2>
        <p class="muted" style="margin:0">Workspace (label statis) · Access roles:</p>
        <div style="margin-top:8px">${accessBadges(currentRoleIds())}</div>
      </section>
      <section class="content-block">
        <h2>Recent Activity</h2>
        <p class="muted" style="margin-top:-8px">Menggunakan data audit yang sudah tersedia.</p>
        <div class="table-scroll"><table><thead><tr><th>Waktu</th><th>Aksi</th><th>Resource</th><th>Actor</th><th class="actions-cell">Detail</th></tr></thead><tbody>${recent}</tbody></table></div>
      </section>
      <section class="content-block"><h2>Quick Actions</h2><div class="header-actions">${actions.join("") || '<span class="muted">Tidak ada aksi yang tersedia untuk akun ini.</span>'}</div></section>`;
  }

  function plannedBanner(note) {
    return `<div class="alert alert-info" role="note"><strong>Planned — konsep desain.</strong><span>${esc(note)} Tidak tersedia di aplikasi saat ini.</span></div>`;
  }

  function renderProjects() {
    const rows = projects.map((p) => `<tr data-search="${esc((p.name + " " + p.status).toLowerCase())}">
      <td class="cell-title">${esc(p.name)}</td><td>${statusBadge(p.status)}</td>
      <td class="mono">${p.members}</td><td class="mono muted">${esc(p.updated)}</td>
      <td class="actions-cell"><button class="link-btn" data-nav="project-detail" data-id="${p.id}">Buka</button></td></tr>`).join("");
    return `
      ${plannedBanner("Projects list masih berupa wireframe masa depan; belum ada API atau entity database.")}
      ${pageHeader("Projects", "Proyek studio (data simulasi).", "")}
      <section class="content-block">
        <div class="toolbar">
          <div class="field"><label for="f-project-search">Cari proyek</label><input id="f-project-search" data-filter="projects" placeholder="Nama atau status" /></div>
          <div class="field"><label for="f-project-status">Status</label><select id="f-project-status" data-filter-select="projects"><option value="">Semua</option><option>In progress</option><option>Prototype</option><option>Planning</option></select></div>
        </div>
        <div class="table-scroll"><table id="table-projects"><thead><tr><th>Project</th><th>Status</th><th>Members</th><th>Updated</th><th class="actions-cell">Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="empty-state" id="empty-projects" hidden>Belum ada proyek yang cocok.</div>
        <div class="pagination"><span>1–${projects.length} dari ${projects.length}</span><div class="page-buttons"><button class="page-btn current">1</button></div></div>
      </section>`;
  }

  function renderProjectDetail() {
    const p = projects.find((x) => x.id === state.params.id) || projects[0];
    return `
      ${plannedBanner("Project detail masih berupa konsep; data di bawah adalah simulasi.")}
      ${pageHeader(p.name, "Ringkasan proyek simulasi.", `${statusBadge(p.status)}`)}
      <section class="content-block"><h2>About</h2><dl class="kv"><dt>Status</dt><dd>${statusBadge(p.status)}</dd><dt>Updated</dt><dd class="mono">${esc(p.updated)}</dd><dt>Members</dt><dd class="mono">${p.members}</dd></dl></section>
      <section class="content-block"><h2>Members</h2>${emptyState("Anggota proyek memerlukan entity ProjectMember (belum ada).", "○")}</section>
      <section class="content-block"><h2>Views</h2><div class="header-actions"><button class="btn btn-secondary btn-sm">Overview</button><button class="btn btn-ghost btn-sm" disabled>Team ${plannedBadge()}</button><button class="btn btn-ghost btn-sm" disabled>Activity ${plannedBadge()}</button></div></section>`;
  }

  function renderTeam() {
    const rows = users.map((u) => `<tr data-search="${esc((u.username + " " + u.email + " " + currentRoleIdsFor(u)).toLowerCase())}" data-role="${esc(u.roleIds.join(","))}">
      <td><span class="cell-title">${esc(u.username)}</span><div class="cell-sub">${esc(u.email)}</div></td>
      <td><span class="badge badge-discipline">—</span> <span class="muted" style="font-size:12px">field belum tersedia</span></td>
      <td>${accessBadges(u.roleIds)}</td><td>${statusBadge(u.isActive)}</td>
      <td class="actions-cell"><div class="row-actions"><button class="link-btn" data-action="view-user" data-id="${u.id}">Detail</button><button class="link-btn" data-action="edit-user" data-id="${u.id}">Edit</button></div></td></tr>`).join("");
    return `
      ${plannedBanner("Team directory memakai data user yang sudah ada; discipline dan project membership belum tersedia.")}
      ${pageHeader("Team", "Anggota studio dan access role mereka.", hasPermission("create:user") ? '<button class="btn btn-primary" data-action="add-user">Tambah anggota</button>' : "")}
      <section class="content-block">
        <div class="toolbar">
          <div class="field"><label for="f-team-search">Cari anggota</label><input id="f-team-search" data-filter="team" placeholder="Nama atau email" /></div>
          <div class="field"><label for="f-team-role">Access role</label><select id="f-team-role" data-filter-select="team"><option value="">Semua role</option>${roles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select></div>
        </div>
        <div class="table-scroll"><table id="table-team"><thead><tr><th>Member</th><th>Discipline</th><th>Access roles</th><th>Status</th><th class="actions-cell">Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="empty-state" id="empty-team" hidden>Tidak ada anggota yang cocok.</div>
      </section>`;
  }
  function currentRoleIdsFor(u) { return (u.roleIds || []).map(roleName).join(" "); }

  function renderUsers() {
    const rows = users.map((u) => {
      const self = u.id === state.currentUser.id;
      const disabled = self ? " disabled title='Rekomendasi UI: akun sendiri tidak dapat diubah; backend tetap otoritatif'" : "";
      return `<tr data-search="${esc((u.username + " " + u.email + " " + currentRoleIdsFor(u)).toLowerCase())}">
        <td><span class="cell-title">${esc(u.username)}</span><div class="cell-sub">${esc(u.email)}</div></td>
        <td>${accessBadges(u.roleIds)}</td><td>${statusBadge(u.isActive)}</td>
        <td class="actions-cell"><div class="row-actions">
          <button class="link-btn" data-action="view-user" data-id="${u.id}">Detail</button>
          <button class="link-btn" data-action="edit-user" data-id="${u.id}"${disabled}>Edit</button>
          <details class="more-menu"><summary>More</summary><div class="more-panel">
            <button class="link-btn" data-action="toggle-user" data-id="${u.id}"${disabled}>${u.isActive ? "Nonaktifkan" : "Aktifkan"}</button>
            <button class="link-btn danger" data-action="delete-user" data-id="${u.id}"${disabled}>Hapus</button>
          </div></details>
        </div></td></tr>`;
    }).join("");
    return `
      ${pageHeader("Users", "Kelola akun dan access role.", hasPermission("create:user") ? '<button class="btn btn-primary" data-action="add-user">Tambah user</button>' : "")}
      <section class="content-block">
        <div class="toolbar"><div class="field"><label for="f-user-search">Cari user</label><input id="f-user-search" data-filter="users" placeholder="Email atau username" /></div></div>
        <div class="table-scroll"><table id="table-users"><thead><tr><th>User</th><th>Access roles</th><th>Status</th><th class="actions-cell">Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="empty-state" id="empty-users" hidden>Belum ada user yang cocok.</div>
        <div class="pagination"><span>1–${users.length} dari ${users.length}</span><div class="page-buttons"><button class="page-btn current">1</button></div></div>
      </section>`;
  }

  function renderRoles() {
    const rows = roles.map((r) => `<tr data-search="${esc(r.name.toLowerCase())}">
      <td><span class="cell-title">${esc(r.name)}</span>${r.isSystem ? '<div class="cell-sub">Role sistem — tidak bisa diubah/dihapus</div>' : ""}</td>
      <td class="mono">${users.filter((u) => u.roleIds.includes(r.id)).length}</td>
      <td class="mono">${(rolePermissions[r.id] || []).length}</td>
      <td class="actions-cell"><div class="row-actions">
        <button class="link-btn" data-action="view-role" data-id="${r.id}">Detail</button>
        ${r.isSystem ? "" : `<button class="link-btn" data-action="edit-role" data-id="${r.id}">Edit</button><button class="link-btn danger" data-action="delete-role" data-id="${r.id}">Hapus</button>`}
      </div></td></tr>`).join("");
    return `
      ${pageHeader("Roles", "Kelola role dan assignment permission.", hasPermission("create:role") ? '<button class="btn btn-primary" data-action="add-role">Tambah role</button>' : "")}
      ${state.catalogFailure ? '<div class="alert alert-danger" role="alert"><strong>Katalog permission gagal dimuat.</strong><span>Simpan dinonaktifkan pada form yang bergantung.</span></div>' : ""}
      <section class="content-block">
        <div class="toolbar"><div class="field"><label for="f-role-search">Cari role</label><input id="f-role-search" data-filter="roles" placeholder="Nama role" /></div></div>
        <div class="table-scroll"><table id="table-roles"><thead><tr><th>Role</th><th>User</th><th>Permission</th><th class="actions-cell">Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="empty-state" id="empty-roles" hidden>Belum ada role yang cocok.</div>
      </section>`;
  }

  function renderPermissions() {
    const rows = permissions.map((p) => `<tr data-search="${esc(p.key.toLowerCase())}">
      <td class="mono">${esc(p.key)}</td><td class="muted">—</td>
      <td>${p.isProtected ? '<span class="badge badge-warning">protected</span>' : '<span class="muted">biasa</span>'}</td>
      <td class="muted">${esc(roles.filter((r) => (rolePermissions[r.id] || []).includes(p.id)).map((r) => r.name).join(", ") || "-")}</td>
      <td class="actions-cell"><div class="row-actions"><button class="link-btn" data-action="edit-permission" data-id="${p.id}">Edit</button><button class="link-btn danger" data-action="delete-permission" data-id="${p.id}">Hapus</button></div></td></tr>`).join("");
    return `
      ${pageHeader("Permissions", "Katalog permission kanonik action:resource.", hasPermission("create:permission") ? '<button class="btn btn-primary" data-action="add-permission">Tambah permission</button>' : "")}
      <section class="content-block">
        <div class="alert alert-warning" role="note"><strong>Drift sample.</strong><span>Contoh: orphan <span class="mono">legacy:unused</span>, unregistered <span class="mono">[]</span>.</span></div>
        <div class="toolbar"><div class="field"><label for="f-perm-search">Cari key</label><input id="f-perm-search" data-filter="permissions" placeholder="action:resource" /></div></div>
        <div class="table-scroll"><table id="table-permissions"><thead><tr><th>Key</th><th>Deskripsi</th><th>Status</th><th>Role</th><th class="actions-cell">Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="empty-state" id="empty-permissions" hidden>Belum ada permission yang cocok.</div>
      </section>`;
  }

  function renderMenus() {
    function node(m) {
      const children = menuItems.filter((x) => x.parentId === m.id);
      const visible = (m.permissionIds || []).some((id) => currentPermissions().has(id) || isSystemActor());
      return `<div class="tree-node"><div class="tree-row"><div>
          <div class="cell-title">${esc(m.name)} ${!m.url ? '<span class="badge badge-discipline">group</span>' : ""}</div>
          <div class="cell-sub mono">${esc(m.url || "—")} · urutan ${m.order} · ${visible ? "terlihat" : "tersembunyi"}</div>
          <div class="muted" style="font-size:12px">permission: ${esc((m.permissionIds || []).map((id) => (permissions.find((p) => p.id === id) || {}).key).join(", ") || "tidak ada")}</div>
        </div><div class="row-actions">
          <button class="link-btn" data-action="view-menu" data-id="${m.id}">Detail</button>
          <button class="link-btn" data-action="add-submenu" data-id="${m.id}">Submenu</button>
          <button class="link-btn" data-action="edit-menu" data-id="${m.id}">Edit</button>
          <button class="link-btn danger" data-action="delete-menu" data-id="${m.id}">Hapus</button>
        </div></div>
        ${children.length ? `<div class="tree-children">${children.map(node).join("")}</div>` : ""}</div>`;
    }
    const roots = menuItems.filter((m) => !m.parentId);
    return `
      ${pageHeader("Menus", "Struktur menu dan permission mapping (ANY-of).", '<button class="btn btn-primary" data-action="add-menu">Tambah menu</button>')}
      ${state.catalogFailure ? '<div class="alert alert-danger" role="alert"><strong>Katalog permission gagal dimuat.</strong><span>Simpan dinonaktifkan.</span></div>' : ""}
      <section class="content-block">${roots.map(node).join("")}</section>
      <p class="muted" style="font-size:12px">Status "terlihat" adalah petunjuk UI, bukan aturan otorisasi.</p>`;
  }

  function renderDelegations() {
    const rows = delegations.map((d) => `<tr data-search="${esc((roleName(d.granteeId) + " " + d.permissionKey).toLowerCase())}">
      <td>${esc(roleName(d.granteeId))}</td><td class="mono">${esc(d.permissionKey)}</td>
      <td>${esc(roleName(d.grantedBy))}</td><td class="mono muted">${esc(d.expiresAt.replace("T", " "))}</td>
      <td>${statusBadge(d.valid ? "valid" : "tidak valid")}</td>
      <td class="actions-cell"><div class="row-actions"><button class="link-btn" data-action="view-delegation" data-id="${d.id}">Detail</button><button class="link-btn danger" data-action="revoke-delegation" data-id="${d.id}">Cabut</button></div></td></tr>`).join("");
    return `
      ${pageHeader("Delegations", "Capability, batasan, dan lineage.", hasPermission("create:delegation") ? '<button class="btn btn-primary" data-action="add-delegation">Buat delegasi</button>' : "")}
      ${state.catalogFailure ? '<div class="alert alert-danger" role="alert"><strong>Katalog permission gagal dimuat.</strong><span>Simpan dinonaktifkan.</span></div>' : ""}
      <section class="content-block">
        <div class="toolbar"><div class="field"><label for="f-deleg-search">Cari</label><input id="f-deleg-search" data-filter="delegations" placeholder="Grantee atau permission" /></div></div>
        <div class="table-scroll"><table id="table-delegations"><thead><tr><th>Grantee</th><th>Permission</th><th>Grantor</th><th>Expired</th><th>Status</th><th class="actions-cell">Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="empty-state" id="empty-delegations" hidden>Belum ada delegasi yang cocok.</div>
      </section>`;
  }

  function renderActivity() {
    const f = state.activityFilters;
    const rows = audit.filter((a) => {
      return (!f.action || a.action.toLowerCase().includes(f.action.toLowerCase())) &&
        (!f.resourceType || a.resourceType.toLowerCase().includes(f.resourceType.toLowerCase())) &&
        (!f.actorId || a.actor.toLowerCase().includes(f.actorId.toLowerCase())) &&
        (!f.resourceId || a.resourceId.toLowerCase().includes(f.resourceId.toLowerCase())) &&
        (!f.from || new Date(a.createdAt) >= new Date(f.from)) &&
        (!f.to || new Date(a.createdAt) <= new Date(f.to + "T23:59"));
    }).map((a) => `<tr>
      <td class="mono muted">${esc(a.createdAt.replace("T", " "))}</td><td class="mono">${esc(a.action)}</td>
      <td>${esc(a.resourceType)} <span class="mono muted">${esc(a.resourceId)}</span></td><td>${esc(a.actor)}</td>
      <td class="actions-cell"><button class="link-btn" data-action="view-audit" data-id="${a.id}">Lihat</button></td></tr>`).join("");
    return `
      ${pageHeader("Activity / Audit", "Riwayat aksi administratif. action memakai format resource.action.", "")}
      <section class="content-block">
        <form class="toolbar" data-form="activity-filter">
          ${field("Action", "action", f.action, { placeholder: "user.create" })}
          ${field("Resource type", "resourceType", f.resourceType, { placeholder: "user" })}
          ${field("Actor", "actorId", f.actorId, { placeholder: "email" })}
          ${field("Resource ID", "resourceId", f.resourceId, { placeholder: "uuid" })}
          ${field("From", "from", f.from, { type: "date" })}
          ${field("To", "to", f.to, { type: "date" })}
          <div class="header-actions" style="align-self:flex-end"><button class="btn btn-secondary btn-sm" type="submit">Filter</button><button class="btn btn-ghost btn-sm" type="button" data-action="reset-activity">Reset</button></div>
        </form>
        <div class="table-scroll"><table><thead><tr><th>Waktu</th><th>Aksi</th><th>Resource</th><th>Actor</th><th class="actions-cell">Detail</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${rows ? "" : emptyState("Tidak ada audit log yang cocok.", "○")}
      </section>`;
  }

  // ---------------------------------------------------------------------
  // Drawers
  // ---------------------------------------------------------------------
  function permissionPicker(selected, allowProtected, disabledAll) {
    const groups = {};
    permissions.forEach((p) => { const g = p.key.split(":")[1] || "other"; (groups[g] = groups[g] || []).push(p); });
    return `<div class="check-list">${Object.keys(groups).map((g) => `
      <p class="muted" style="font-size:11px;margin:8px 0 2px;text-transform:uppercase">${esc(g)}</p>
      ${groups[g].map((p) => {
        const locked = (p.isProtected && !allowProtected) || disabledAll;
        return `<label class="${locked ? "disabled" : ""}"><input type="checkbox" name="permissionIds" value="${p.id}" ${selected.includes(p.id) ? "checked" : ""} ${locked ? "disabled" : ""}/><span class="mono">${esc(p.key)}</span>${p.isProtected ? '<span class="badge badge-warning">protected</span>' : ""}</label>`;
      }).join("")}`).join("")}</div>`;
  }

  function roleCheckboxList(selected, disabled) {
    return `<div class="check-list">${roles.map((r) => `<label class="${disabled ? "disabled" : ""}"><input type="checkbox" name="roleIds" value="${r.id}" ${selected.includes(r.id) ? "checked" : ""} ${disabled ? "disabled" : ""}/><span>${esc(r.name)}</span>${r.isSystem ? '<span class="badge badge-access">system</span>' : ""}</label>`).join("")}</div>`;
  }

  function openUserDrawer(id) {
    const u = id ? users.find((x) => x.id === id) : null;
    const self = Boolean(u && u.id === state.currentUser.id);
    const selfAlert = self ? '<div class="alert alert-warning" role="note"><strong>Akun sendiri.</strong><span>Rekomendasi UI: Edit/status/Delete dinonaktifkan. Backend tetap otoritatif.</span></div>' : "";
    const body = `
      ${selfAlert}
      <div class="drawer-grid">
        ${field("Email", "email", u ? u.email : "", { disabled: Boolean(u), full: true, type: "email" })}
        ${field("Username", "username", u ? u.username : "", { disabled: Boolean(u), placeholder: "opsional" })}
        ${field("Nama", "name", u ? u.name : "", { placeholder: "Nama lengkap" })}
        ${field("Telepon", "phone", u ? u.phone : "", { placeholder: "opsional" })}
        ${u ? "" : field("Password", "password", "", { type: "password", placeholder: "Minimal 6 karakter", full: true })}
        <div class="full"><label class="field"><span>Access roles (dinamis dari API)</span>${roleCheckboxList(u ? u.roleIds : [], self)}</label></div>
        ${u ? `<label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="isActive" ${u.isActive ? "checked" : ""} ${self ? "disabled" : ""}/> Aktif</label>` : ""}
      </div>`;
    const footer = `<button class="btn btn-secondary" data-action="close-drawer">Batal</button><button class="btn btn-primary" data-action="save-user" data-id="${u ? u.id : ""}" ${self ? "disabled" : ""}>Simpan</button>`;
    openDrawer(u ? "Edit user" : "User baru", body, footer);
  }

  function openRoleDrawer(id) {
    const r = id ? roles.find((x) => x.id === id) : null;
    const selected = r ? (rolePermissions[r.id] || []) : [];
    const body = `
      <div class="drawer-grid">
        ${field("Nama role", "name", r ? r.name : "", { full: true })}
        ${field("Deskripsi", "description", "", { full: true, placeholder: "opsional" })}
        <div class="full">
          <div class="alert alert-warning" role="note"><strong>Perhatian.</strong><span>Menyimpan akan <b>mengganti seluruh</b> permission role ini, bukan menambahkan.</span></div>
          <label class="field"><span>Permission (action:resource)</span>${permissionPicker(selected, isSystemActor(), state.catalogFailure)}</label>
        </div>
      </div>`;
    const footer = `<button class="btn btn-secondary" data-action="close-drawer">Batal</button><button class="btn btn-primary" data-action="save-role" data-id="${r ? r.id : ""}" ${state.catalogFailure ? "disabled" : ""}>Simpan</button>`;
    openDrawer(r ? `Edit role — ${r.name}` : "Role baru", body, footer);
  }

  function openPermissionDrawer(id) {
    const p = id ? permissions.find((x) => x.id === id) : null;
    const body = `<div class="drawer-grid">
      ${field("Key (action:resource)", "key", p ? p.key : "", { disabled: Boolean(p), full: true, placeholder: "read:menu" })}
      ${field("Deskripsi", "description", "", { full: true, placeholder: "opsional" })}
      ${isSystemActor() ? `<label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="isProtected" ${p && p.isProtected ? "checked" : ""}/> Protected</label>` : ""}
    </div>`;
    const footer = `<button class="btn btn-secondary" data-action="close-drawer">Batal</button><button class="btn btn-primary" data-action="save-permission" data-id="${p ? p.id : ""}">Simpan</button>`;
    openDrawer(p ? "Edit permission" : "Permission baru", body, footer);
  }

  function descendantsOfMenus(id) {
    const out = [];
    menuItems.filter((m) => m.parentId === id).forEach((c) => { out.push(c.id); out.push(...descendantsOfMenus(c.id)); });
    return out;
  }

  function openMenuDrawer(id, parentId) {
    const m = id ? menuItems.find((x) => x.id === id) : null;
    const forbidden = m ? descendantsOfMenus(m.id) : [];
    const options = `<option value="">Tidak ada parent</option>` + menuItems.filter((x) => x.id !== id && !forbidden.includes(x.id)).map((x) => `<option value="${x.id}" ${m && m.parentId === x.id ? "selected" : ""} ${parentId === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("");
    const body = `<div class="drawer-grid">
      ${field("Nama", "name", m ? m.name : "", { full: true })}
      ${field("URL (/path, kosong untuk group)", "url", m ? m.url : "", { placeholder: "/path" })}
      ${field("Icon", "icon", m ? m.icon : "", { placeholder: "pi pi-users" })}
      ${field("Urutan", "order", m ? m.order : 0, { type: "number" })}
      <div class="full"><label class="field"><span>Parent</span><select name="parentId">${options}</select></label></div>
      ${field("Deskripsi", "description", m ? m.description : "", { full: true })}
      <label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="isActive" ${!m || m.isActive ? "checked" : ""}/> Aktif</label>
      <div class="full"><label class="field"><span>Permission (ANY-of)</span>${permissionPicker(m ? m.permissionIds : [], isSystemActor(), state.catalogFailure)}</label></div>
    </div>`;
    const footer = `<button class="btn btn-secondary" data-action="close-drawer">Batal</button><button class="btn btn-primary" data-action="save-menu" data-id="${m ? m.id : ""}" ${state.catalogFailure ? "disabled" : ""}>Simpan</button>`;
    openDrawer(m ? "Edit menu" : "Menu baru", body, footer);
  }

  function delegablePermissions() {
    const mine = currentPermissions();
    return permissions.filter((p) => {
      if (p.key === "grant:admin") return false;
      if (p.key === "create:delegation") return isSystemActor();
      if (!isSystemActor() && p.isProtected) return false;
      if (!isSystemActor() && !mine.has(p.id)) return false;
      return true;
    });
  }
  function openDelegationDrawer() {
    const opts = users.map((u) => `<option value="${u.id}">${esc(u.username)} — ${esc(u.email)}</option>`).join("");
    const picker = delegablePermissions().map((p) => `<label><input type="checkbox" name="permissionKeys" value="${p.key}"/><span class="mono">${esc(p.key)}</span></label>`).join("");
    const body = `<div class="drawer-grid">
      <div class="full"><label class="field"><span>Grantee</span><select name="granteeId"><option value="">Pilih grantee</option>${opts}</select></label></div>
      ${field("Expires at", "expiresAt", "", { type: "datetime-local", min: localInput(1), max: localInput(90 * 24 * 60), full: true })}
      <p class="muted full" style="font-size:12px;margin:0">Maksimal 90 hari. Parent capability ditentukan otomatis oleh server.</p>
      <div class="full"><label class="field"><span>Permission yang dapat didelegasikan</span><div class="check-list">${picker || '<span class="muted">Tidak ada permission yang memenuhi syarat.</span>'}</div></label></div>
      <div class="full alert alert-info" role="note"><span>Backend tetap memvalidasi: grant:admin dilarang; create:delegation hanya untuk actor dengan isSystem; protected dan permission/capability divalidasi saat submit.</span></div>
    </div>`;
    const footer = `<button class="btn btn-secondary" data-action="close-drawer">Batal</button><button class="btn btn-primary" data-action="save-delegation" ${state.catalogFailure ? "disabled" : ""}>Simpan</button>`;
    openDrawer("Delegasi baru", body, footer);
  }

  function openDetailDrawer(title, body) {
    openDrawer(title, body, '<button class="btn btn-secondary" data-action="close-drawer">Tutup</button>');
  }

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------
  function handleAction(action, data, event) {
    const id = data.id;
    switch (action) {
      case "logout":
        state.currentUser = null; state.screen = "login"; state.authError = ""; render(); break;
      case "dismiss-toast": event.target.closest(".toast").remove(); break;
      case "close-drawer": closeDrawer(); break;
      case "close-modal": closeModal(); break;
      case "confirm-yes": { const fn = state.pendingConfirm; closeModal(); if (fn) fn(); break; }
      case "reset-activity": state.activityFilters = { action: "", resourceType: "", actorId: "", resourceId: "", from: "", to: "" }; render(); break;
      case "add-user": openUserDrawer(null); break;
      case "edit-user": if (hasPermission("update:user")) openUserDrawer(id); break;
      case "view-user": {
        const u = users.find((x) => x.id === id);
        openDetailDrawer("Detail user", `<dl class="kv"><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Username</dt><dd>${esc(u.username)}</dd><dt>Nama</dt><dd>${esc(u.name || "-")}</dd><dt>Status</dt><dd>${statusBadge(u.isActive)}</dd><dt>Access roles</dt><dd>${accessBadges(u.roleIds)}</dd></dl>`);
        break;
      }
      case "toggle-user": {
        const u = users.find((x) => x.id === id); u.isActive = !u.isActive; render();
        showToast(u.isActive ? "User diaktifkan." : "User dinonaktifkan.", "success"); break;
      }
      case "delete-user": {
        const u = users.find((x) => x.id === id);
        openModal({ title: "Hapus user?", text: `Akun ${u.email} akan dihapus permanen.`, confirmLabel: "Ya, hapus", danger: true, onConfirm: () => {
          const i = users.findIndex((x) => x.id === id); users.splice(i, 1); render(); showToast("User dihapus.", "success");
        } }); break;
      }
      case "add-role": openRoleDrawer(null); break;
      case "edit-role": openRoleDrawer(id); break;
      case "view-role": {
        const r = roles.find((x) => x.id === id);
        openDetailDrawer("Detail role", `<dl class="kv"><dt>Nama</dt><dd>${esc(r.name)}</dd><dt>System</dt><dd>${r.isSystem ? "Ya" : "Tidak"}</dd><dt>Permission</dt><dd class="mono">${esc((rolePermissions[r.id] || []).map((pid) => (permissions.find((p) => p.id === pid) || {}).key).join(", ") || "-")}</dd></dl>`);
        break;
      }
      case "delete-role": {
        const r = roles.find((x) => x.id === id);
        openModal({ title: "Hapus role?", text: `Role ${r.name} akan dihapus.`, confirmLabel: "Ya, hapus", danger: true, onConfirm: () => {
          const i = roles.findIndex((x) => x.id === id); roles.splice(i, 1); delete rolePermissions[id]; render(); showToast("Role dihapus.", "success");
        } }); break;
      }
      case "add-permission": openPermissionDrawer(null); break;
      case "edit-permission": openPermissionDrawer(id); break;
      case "delete-permission": {
        const p = permissions.find((x) => x.id === id);
        openModal({ title: "Hapus permission?", text: `${p.key} akan dihapus jika tidak dipakai role/menu/delegasi.`, confirmLabel: "Ya, hapus", danger: true, onConfirm: () => showToast("Permission dihapus (simulasi).", "success") }); break;
      }
      case "add-menu": openMenuDrawer(null, null); break;
      case "add-submenu": openMenuDrawer(null, id); break;
      case "edit-menu": openMenuDrawer(id, null); break;
      case "view-menu": {
        const m = menuItems.find((x) => x.id === id);
        openDetailDrawer("Detail menu", `<dl class="kv"><dt>Nama</dt><dd>${esc(m.name)}</dd><dt>URL</dt><dd class="mono">${esc(m.url || "-")}</dd><dt>Parent</dt><dd>${esc(m.parentId ? (menuItems.find((x) => x.id === m.parentId) || {}).name : "-")}</dd><dt>Permission</dt><dd class="mono">${esc((m.permissionIds || []).map((pid) => (permissions.find((p) => p.id === pid) || {}).key).join(", ") || "-")}</dd></dl>`);
        break;
      }
      case "delete-menu": {
        const m = menuItems.find((x) => x.id === id);
        openModal({ title: "Hapus menu?", text: `Menu "${m.name}" akan dihapus. Anak menjadi root.`, confirmLabel: "Ya, hapus", danger: true, onConfirm: () => {
          const i = menuItems.findIndex((x) => x.id === id); menuItems.splice(i, 1); render(); showToast("Menu dihapus.", "success");
        } }); break;
      }
      case "add-delegation": openDelegationDrawer(); break;
      case "view-delegation": {
        const d = delegations.find((x) => x.id === id);
        openDetailDrawer("Detail delegasi", `<dl class="kv"><dt>Grantee</dt><dd>${esc(roleName(d.granteeId))}</dd><dt>Grantor</dt><dd>${esc(roleName(d.grantedBy))}</dd><dt>Permission</dt><dd class="mono">${esc(d.permissionKey)}</dd><dt>Parent</dt><dd class="mono">${esc(d.parentCapabilityId || "root")}</dd><dt>Expired</dt><dd class="mono">${esc(d.expiresAt)}</dd><dt>Status</dt><dd>${statusBadge(d.valid ? "valid" : "tidak valid")}</dd></dl>`);
        break;
      }
      case "revoke-delegation": {
        const d = delegations.find((x) => x.id === id);
        openModal({ title: "Cabut delegasi?", text: `Capability ${d.permissionKey} untuk ${roleName(d.granteeId)} akan dicabut beserta turunannya.`, confirmLabel: "Ya, cabut", danger: true, onConfirm: () => {
          const i = delegations.findIndex((x) => x.id === id); delegations.splice(i, 1); render();
          showToast(`Delegasi dicabut. Descendant: ${d.parentCapabilityId ? "1 (simulasi)" : "tidak ada"}.`, "info");
        } }); break;
      }
      case "view-audit": {
        const a = audit.find((x) => x.id === id);
        openDrawer("Detail audit log", `<dl class="kv"><dt>Aksi</dt><dd class="mono">${esc(a.action)}</dd><dt>Resource</dt><dd>${esc(a.resourceType)} <span class="mono">${esc(a.resourceId)}</span></dd><dt>Actor</dt><dd>${esc(a.actor)}</dd><dt>Waktu</dt><dd class="mono">${esc(a.createdAt)}</dd></dl>
          <div class="before-after" style="margin-top:16px"><div><h3>Before</h3><pre>${esc(JSON.stringify(a.before, null, 2))}</pre></div><div><h3>After</h3><pre>${esc(JSON.stringify(a.after, null, 2))}</pre></div></div>`,
          '<button class="btn btn-secondary" data-action="close-drawer">Tutup</button>', true);
        break;
      }
      case "save-user": {
        const form = document.querySelector('[data-action="save-user"]').closest(".drawer").querySelector("form, .drawer-body");
        const get = (n) => { const el = form.querySelector(`[name="${n}"]`); return el ? el.value.trim() : ""; };
        const password = get("password");
        if (!get("email") || (!id && password.length < 6)) { showToast("Email wajib diisi dan password minimal 6 karakter.", "error"); return; }
        const roleIds = Array.from(form.querySelectorAll('[name="roleIds"]:checked')).map((x) => x.value);
        if (id) {
          const u = users.find((x) => x.id === id);
          u.name = get("name"); u.phone = get("phone"); u.roleIds = roleIds;
          const active = form.querySelector('[name="isActive"]'); if (active) u.isActive = active.checked;
        } else {
          users.push({ id: "u-" + (users.length + 1), username: get("username") || get("email").split("@")[0], email: get("email"), name: get("name"), phone: get("phone"), isActive: true, roleIds });
        }
        closeDrawer(); render(); showToast(id ? "User diperbarui." : "User dibuat.", "success"); break;
      }
      case "save-role": {
        if (state.catalogFailure) { showToast("Katalog permission gagal dimuat. Simpan dibatalkan.", "error"); return; }
        const body = document.querySelector('[data-action="save-role"]').closest(".drawer").querySelector(".drawer-body");
        const name = body.querySelector('[name="name"]').value.trim();
        if (!name) { showToast("Nama role wajib diisi.", "error"); return; }
        const selected = Array.from(body.querySelectorAll('[name="permissionIds"]:checked')).map((x) => x.value);
        if (id) { roles.find((x) => x.id === id).name = name; rolePermissions[id] = selected; }
        else { const newId = "r-" + (roles.length + 1); roles.push({ id: newId, name, isSystem: false }); rolePermissions[newId] = selected; }
        closeDrawer(); render(); showToast("Permission role disimpan (seluruh assignment diganti).", "success"); break;
      }
      case "save-permission": {
        const body = document.querySelector('[data-action="save-permission"]').closest(".drawer").querySelector(".drawer-body");
        const key = body.querySelector('[name="key"]').value.trim();
        if (!/^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/.test(key)) { showToast("Key harus berformat action:resource.", "error"); return; }
        if (!id) permissions.push({ id: "p-" + (permissions.length + 1), key, isProtected: Boolean(body.querySelector('[name="isProtected"]') && body.querySelector('[name="isProtected"]').checked) });
        closeDrawer(); render(); showToast("Permission disimpan.", "success"); break;
      }
      case "save-menu": {
        if (state.catalogFailure) { showToast("Katalog permission gagal dimuat. Simpan dibatalkan.", "error"); return; }
        const body = document.querySelector('[data-action="save-menu"]').closest(".drawer").querySelector(".drawer-body");
        const get = (n) => { const el = body.querySelector(`[name="${n}"]`); return el ? el.value.trim() : ""; };
        const name = get("name");
        if (!name) { showToast("Nama menu wajib diisi.", "error"); return; }
        const permissionIds = Array.from(body.querySelectorAll('[name="permissionIds"]:checked')).map((x) => x.value);
        const payload = { name, url: get("url") || null, icon: get("icon") || null, parentId: get("parentId") || null, order: Number(get("order") || 0), description: get("description") || null, isActive: Boolean(body.querySelector('[name="isActive"]').checked), permissionIds };
        if (id) Object.assign(menuItems.find((x) => x.id === id), payload); else menuItems.push(Object.assign({ id: "m-" + (menuItems.length + 1) }, payload));
        closeDrawer(); render(); showToast("Menu disimpan.", "success"); break;
      }
      case "save-delegation": {
        if (state.catalogFailure) { showToast("Katalog permission gagal dimuat. Simpan dibatalkan.", "error"); return; }
        const body = document.querySelector('[data-action="save-delegation"]').closest(".drawer").querySelector(".drawer-body");
        const granteeId = body.querySelector('[name="granteeId"]').value;
        const expiresAt = body.querySelector('[name="expiresAt"]').value;
        const permissionKeys = Array.from(body.querySelectorAll('[name="permissionKeys"]:checked')).map((x) => x.value);
        if (!granteeId || !expiresAt || !permissionKeys.length) { showToast("Grantee, permission, dan expiry wajib diisi.", "error"); return; }
        delegations.push({ id: "d-" + (delegations.length + 1), granteeId, permissionKey: permissionKeys[0], grantedBy: state.currentUser.id, parentCapabilityId: null, expiresAt, valid: true });
        closeDrawer(); render(); showToast("Delegasi dibuat.", "success"); break;
      }
      default: break;
    }
  }

  // ---------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) { event.preventDefault(); navigate(nav.getAttribute("data-nav")); return; }
    const action = event.target.closest("[data-action]");
    if (action) {
      const act = action.getAttribute("data-action");
      handleAction(act, { id: action.getAttribute("data-id") }, event);
      return;
    }
    if (event.target.closest("#menu-toggle")) {
      const sidebar = $("sidebar"); const open = !sidebar.classList.contains("open");
      sidebar.classList.toggle("open", open); $("sidebar-scrim").hidden = !open;
      $("menu-toggle").setAttribute("aria-expanded", String(open)); return;
    }
    if (event.target.closest("#sidebar-scrim")) {
      $("sidebar").classList.remove("open"); $("sidebar-scrim").hidden = true; $("menu-toggle").setAttribute("aria-expanded", "false"); return;
    }
    if (event.target.closest("#profile-btn")) {
      const menu = $("profile-menu"); menu.hidden = !menu.hidden;
      $("profile-btn").setAttribute("aria-expanded", String(!menu.hidden)); return;
    }
    if (event.target.closest("#toggle-catalog")) {
      closeDrawer(); closeModal();
      state.catalogFailure = !state.catalogFailure; renderShell();
      showToast(state.catalogFailure ? "Simulasi katalog gagal AKTIF." : "Simulasi katalog gagal NONAKTIF.", "info"); return;
    }
    if (event.target.closest("#toggle-actor")) {
      closeDrawer(); closeModal();
      state.actorIsSystem = !state.actorIsSystem;
      state.currentUser.roleIds = state.actorIsSystem ? ["r-sys"] : ["r-ed"];
      renderShell(); showToast("Actor diubah untuk simulasi: " + (isSystemActor() ? "superadmin" : "Editor") + ".", "info"); return;
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();
    const name = form.getAttribute("data-form");
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    if (name === "login") {
      if (!email || password.length < 6) { state.authError = "Email wajib diisi dan password minimal 6 karakter."; renderAuth(); return; }
      state.authError = "";
      state.currentUser = { id: "u-self", name: "Ari", email, roleIds: state.actorIsSystem ? ["r-sys"] : ["r-ed"] };
      state.screen = "overview"; render(); showToast("Login berhasil (simulasi).", "success"); return;
    }
    if (name === "register") {
      if (!email || password.length < 6) { state.authError = "Email wajib diisi dan password minimal 6 karakter."; renderAuth(); return; }
      const username = String(data.get("username") || "").trim();
      if (username && !/^[a-z0-9_]{3,30}$/.test(username)) { state.authError = "Username harus 3-30 karakter [a-z0-9_]."; renderAuth(); return; }
      state.authError = ""; state.registerSuccess = true; renderAuth(); showToast("Registrasi berhasil (simulasi).", "success"); return;
    }
    if (name === "activity-filter") {
      state.activityFilters = {
        action: String(data.get("action") || ""), resourceType: String(data.get("resourceType") || ""),
        actorId: String(data.get("actorId") || ""), resourceId: String(data.get("resourceId") || ""),
        from: String(data.get("from") || ""), to: String(data.get("to") || ""),
      };
      render(); return;
    }
  });

  function applyFilter(kind) {
    const table = $("table-" + kind);
    if (!table) return;
    const input = document.querySelector(`[data-filter="${kind}"]`);
    const q = input ? input.value.trim().toLowerCase() : "";
    const select = document.querySelector(`[data-filter-select="${kind}"]`);
    const roleFilter = select ? select.value : "";
    let visible = 0;
    table.querySelectorAll("tbody tr[data-search]").forEach((row) => {
      const matchQ = !q || row.getAttribute("data-search").includes(q);
      const matchRole = !roleFilter || (row.getAttribute("data-role") || "").includes(roleFilter);
      row.hidden = !(matchQ && matchRole);
      if (!row.hidden) visible++;
    });
    const empty = $("empty-" + kind);
    if (empty) empty.hidden = visible > 0;
  }
  document.addEventListener("input", (event) => {
    const kind = event.target.getAttribute("data-filter");
    if (kind) applyFilter(kind);
  });
  document.addEventListener("change", (event) => {
    const kind = event.target.getAttribute("data-filter-select");
    if (kind) applyFilter(kind);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if ($("modal-root").firstElementChild) { closeModal(); return; }
      if ($("drawer-root").firstElementChild) { closeDrawer(); return; }
      const sidebar = $("sidebar"); if (sidebar.classList.contains("open")) { sidebar.classList.remove("open"); $("sidebar-scrim").hidden = true; }
      const menu = $("profile-menu"); if (menu && !menu.hidden) { menu.hidden = true; }
      return;
    }
    if (event.key !== "Tab") return;
    const modal = $("modal-root").firstElementChild;
    const drawer = $("drawer-root").firstElementChild;
    const container = modal || drawer;
    if (!container) return;
    const items = focusables(container);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  state.screen = "login";
  render();
})();
