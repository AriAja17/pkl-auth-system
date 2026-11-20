'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiPage } from '@/lib/api';
import type { MenuNode, Page, PermissionView } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import { apiErrorText, handleUnauthorized } from '@/lib/errors';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  Input,
  LoadingState,
  Select,
  Toast,
  type ToastState,
} from '@/components/ui';
import PageHeader from '@/components/page-header';
import PermissionPicker, { type CatalogState } from '@/components/permission-picker';

type FormState = {
  name: string;
  url: string;
  icon: string;
  parentId: string;
  permissionIds: string[];
  order: number;
  description: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: '',
  url: '',
  icon: '',
  parentId: '',
  permissionIds: [],
  order: 0,
  description: '',
  isActive: true,
};

const URL_PATTERN = /^\/(?!\/)[^\s]*$/;
const ICON_PATTERN = /^(pi[a-z0-9-]*)(\s+pi[a-z0-9-]*)*$/i;

function flatten(nodes: MenuNode[], skipId?: string): MenuNode[] {
  const result: MenuNode[] = [];
  for (const node of nodes) {
    if (node.id === skipId) continue;
    result.push(node);
    result.push(...flatten(node.children, skipId));
  }
  return result;
}

function descendantsOf(nodes: MenuNode[], id: string): Set<string> {
  const result = new Set<string>();
  for (const node of nodes) {
    if (node.parentId === id) {
      result.add(node.id);
      for (const child of descendantsOf(nodes, node.id)) result.add(child);
    }
  }
  return result;
}

export default function MenusPage() {
  const { has, me } = useAuth();
  const canonicalPermissions = useMemo(() => me?.canonicalPermissions ?? [], [me]);
  const router = useRouter();
  const [data, setData] = useState<Page<MenuNode> | null>(null);
  const [permissions, setPermissions] = useState<PermissionView[]>([]);
  const [catalogState, setCatalogState] = useState<CatalogState>('loading');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dialog, setDialog] = useState<{
    title: string;
    text: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MenuNode | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setData(await apiPage<MenuNode>('/admin/menus?page=1&limit=100'));
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const result = await apiPage<PermissionView>('/admin/permissions?page=1&limit=100');
      setPermissions(result.items);
      setCatalogState(result.items.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      if (handleUnauthorized(err, router)) return;
      setPermissions([]);
      setCatalogState('error');
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (active) await load();
      } catch (err) {
        if (!active || handleUnauthorized(err, router)) return;
        setToast({ type: 'error', text: apiErrorText(err, 'Gagal memuat menu.') });
      }
    })();
    return () => {
      active = false;
    };
  }, [load, router]);

  useEffect(() => {
    void (async () => {
      await loadCatalog();
    })();
  }, [loadCatalog]);

  const flat = useMemo(() => (data ? flatten(data.items) : []), [data]);
  const forbiddenParents = useMemo(
    () => (editingId && data ? descendantsOf(data.items, editingId) : new Set<string>()),
    [editingId, data],
  );

  // Non-authoritative hint only. Backend visibleMenus() remains authoritative.
  const visibleIds = useMemo(() => {
    const visible = new Set<string>();
    if (!data) return visible;
    for (const node of flatten(data.items)) {
      const keys = node.permissions ?? [];
      if (keys.length > 0 && keys.some((key) => canonicalPermissions.includes(key))) {
        visible.add(node.id);
      }
    }
    const byId = new Map(flat.map((node) => [node.id, node]));
    for (const id of [...visible]) {
      let parentId = byId.get(id)?.parentId ?? null;
      const seen = new Set<string>();
      while (parentId) {
        if (seen.has(parentId) || !visible.has(parentId)) {
          visible.delete(id);
          break;
        }
        seen.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
    }
    return visible;
  }, [data, flat, canonicalPermissions]);

  function reportError(err: unknown) {
    if (handleUnauthorized(err, router)) return;
    setToast({ type: 'error', text: apiErrorText(err) });
  }

  function openCreate(parentId = '') {
    setEditingId(null);
    setForm({ ...emptyForm, parentId });
  }

  async function openEdit(node: MenuNode) {
    let catalog = permissions;
    if (catalog.length === 0) {
      try {
        const result = await apiPage<PermissionView>('/admin/permissions?page=1&limit=100');
        catalog = result.items;
        setPermissions(catalog);
        setCatalogState(catalog.length === 0 ? 'empty' : 'ready');
      } catch (err) {
        if (handleUnauthorized(err, router)) return;
        catalog = [];
        setCatalogState('error');
      }
    }
    const idsByKey = new Map(catalog.map((permission) => [permission.key, permission.id]));
    setEditingId(node.id);
    setForm({
      name: node.name,
      url: node.url ?? '',
      icon: node.icon ?? '',
      parentId: node.parentId ?? '',
      permissionIds: (node.permissions ?? [])
        .map((key) => idsByKey.get(key))
        .filter((id): id is string => Boolean(id)),
      order: node.order,
      description: node.description ?? '',
      isActive: node.isActive,
    });
  }

  async function submit() {
    if (!form || catalogState !== 'ready') return;
    if (form.url && !URL_PATTERN.test(form.url)) {
      setToast({ type: 'error', text: 'URL harus diawali /' });
      return;
    }
    if (form.icon && !ICON_PATTERN.test(form.icon)) {
      setToast({ type: 'error', text: 'Icon harus berupa kelas PrimeIcons' });
      return;
    }
    if (form.parentId && forbiddenParents.has(form.parentId)) {
      setToast({ type: 'error', text: 'Parent tidak boleh merupakan turunan sendiri' });
      return;
    }

    const body = {
      name: form.name,
      url: form.url || null,
      icon: form.icon || null,
      parentId: form.parentId || null,
      permissionIds: form.permissionIds,
      order: form.order,
      description: form.description || null,
      isActive: form.isActive,
    };

    setBusy(true);
    try {
      if (editingId) {
        await api(`/admin/menus/${editingId}`, { method: 'PATCH', body });
      } else {
        await api('/admin/menus', { method: 'POST', body });
      }
      setToast({ type: 'ok', text: editingId ? 'Menu diperbarui' : 'Menu dibuat' });
      setForm(null);
      setEditingId(null);
      await load();
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(node: MenuNode) {
    setDialog({
      title: 'Hapus menu?',
      text: `Menu ‘${node.name}’ akan dihapus. Anak menjadi root.`,
      confirmLabel: 'Ya, hapus',
      danger: true,
      onConfirm: () => {
        setDialog(null);
        void (async () => {
          try {
            await api(`/admin/menus/${node.id}`, { method: 'DELETE' });
            setToast({ type: 'ok', text: 'Menu dihapus' });
            await load();
          } catch (err) {
            reportError(err);
          }
        })();
      },
    });
  }

  async function showDetail(node: MenuNode) {
    try {
      setDetail(await api<MenuNode>(`/admin/menus/${node.id}`));
    } catch (err) {
      reportError(err);
    }
  }

  function togglePermission(id: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            permissionIds: current.permissionIds.includes(id)
              ? current.permissionIds.filter((value) => value !== id)
              : [...current.permissionIds, id],
          }
        : current,
    );
  }

  function renderTree(nodes: MenuNode[], depth = 0): React.ReactNode {
    return nodes.map((node) => (
      <div key={node.id} className={depth > 0 ? 'ml-3 border-l border-border-subtle pl-3' : ''}>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">{node.name}</p>
            <p className="text-xs text-text-muted">
              <span className="font-mono">{node.url ?? 'group'}</span> · urutan {node.order} ·{' '}
              <span className={visibleIds.has(node.id) ? 'text-success' : 'text-warning'}>
                {visibleIds.has(node.id) ? 'terlihat' : 'tersembunyi'}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              permission:{' '}
              <span className="font-mono">
                {node.permissions.join(', ') || 'tidak ada'}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="link" size="sm" onClick={() => void showDetail(node)}>
              Detail
            </Button>
            {has('create:menu') && (
              <Button variant="link" size="sm" onClick={() => openCreate(node.id)}>
                Submenu
              </Button>
            )}
            {has('update:menu') && (
              <Button variant="link" size="sm" onClick={() => void openEdit(node)}>
                Edit
              </Button>
            )}
            {has('delete:menu') && (
              <Button
                variant="link"
                size="sm"
                className="text-danger"
                onClick={() => requestDelete(node)}
              >
                Hapus
              </Button>
            )}
          </div>
        </div>
        {node.children.length > 0 && (
          <div className="mt-2 space-y-2">{renderTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  }

  if (!has('read:menu')) {
    return <EmptyState title="Tidak ada akses" text="Anda tidak memiliki izin read:menu." />;
  }

  const selectedPermissionIds = form?.permissionIds ?? [];
  const selectedKeys = selectedPermissionIds
    .map((id) => permissions.find((permission) => permission.id === id)?.key)
    .filter((key): key is string => Boolean(key));
  const saveDisabled = busy || catalogState !== 'ready';

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <PageHeader
        title="Menu"
        description="Struktur menu, hierarchy, dan permission mapping (ANY-of)."
        action={
          has('create:menu') ? (
            <Button onClick={() => openCreate()}>Tambah menu</Button>
          ) : undefined
        }
      />

      <p className="text-xs text-text-muted">
        Status ‘terlihat’ adalah petunjuk UI, bukan aturan akses. Backend tetap menentukan menu yang terlihat.
      </p>

      <div className="rounded-md border border-border-subtle bg-surface p-4">
        {!data ? (
          <LoadingState rows={4} />
        ) : data.items.length === 0 ? (
          <EmptyState title="Belum ada menu" text="Buat menu pertama dengan permission read:menu." />
        ) : (
          <div className="space-y-2">{renderTree(data.items)}</div>
        )}
      </div>

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={editingId ? 'Edit menu' : 'Menu baru'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Batal</Button>
            <Button onClick={() => void submit()} loading={busy} disabled={saveDisabled}>
              Simpan
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama" htmlFor="menu-name" required>
                <Input
                  id="menu-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="URL (/path, kosong untuk group)" htmlFor="menu-url">
                <Input
                  id="menu-url"
                  value={form.url}
                  onChange={(event) => setForm({ ...form, url: event.target.value })}
                />
              </Field>
              <Field label="Icon (pi pi-users)" htmlFor="menu-icon">
                <Input
                  id="menu-icon"
                  value={form.icon}
                  onChange={(event) => setForm({ ...form, icon: event.target.value })}
                />
              </Field>
              <Field label="Urutan" htmlFor="menu-order">
                <Input
                  id="menu-order"
                  type="number"
                  value={form.order}
                  onChange={(event) => setForm({ ...form, order: Number(event.target.value) })}
                />
              </Field>
              <Field label="Parent" htmlFor="menu-parent">
                <Select
                  id="menu-parent"
                  value={form.parentId}
                  onChange={(event) => setForm({ ...form, parentId: event.target.value })}
                >
                  <option value="">Tidak ada parent</option>
                  {flat
                    .filter((node) => !forbiddenParents.has(node.id))
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Deskripsi" htmlFor="menu-description">
                <Input
                  id="menu-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </Field>
            </div>

            <Checkbox
              label="Aktif"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />

            <PermissionPicker
              permissions={permissions}
              selectedKeys={selectedKeys}
              onToggle={(key) => {
                const id = permissions.find((permission) => permission.key === key)?.id;
                if (id) togglePermission(id);
              }}
              state={catalogState}
              onRetry={() => {
                setCatalogState('loading');
                void loadCatalog();
              }}
              hint="Semua permission yang dicentang akan mengganti mapping menu ini."
            />
          </div>
        )}
      </Drawer>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detail menu"
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>Tutup</Button>
        }
      >
        {detail && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-text-muted">Nama</dt>
              <dd className="font-medium">{detail.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">URL</dt>
              <dd className="font-mono">{detail.url ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Icon</dt>
              <dd className="font-mono">{detail.icon ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Parent</dt>
              <dd className="font-mono">{detail.parentId ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Permission</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {detail.permissions.map((key) => (
                  <Badge key={key} variant="neutral"><span className="font-mono">{key}</span></Badge>
                ))}
              </dd>
            </div>
          </dl>
        )}
      </Drawer>
    </div>
  );
}
