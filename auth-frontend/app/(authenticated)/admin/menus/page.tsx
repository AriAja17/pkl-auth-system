'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiPage, ApiError, clearToken } from '@/lib/api';
import type { MenuNode, Page, PermissionView } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  Toast,
  type ToastState,
} from '../_components/ui';

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

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (active) await load();
      } catch (err) {
        if (active) {
          if (err instanceof ApiError && err.status === 401) {
            clearToken();
            router.replace('/login');
          } else {
            setToast({ type: 'error', text: err instanceof Error ? err.message : 'Gagal memuat' });
          }
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [load, router]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await apiPage<PermissionView>('/admin/permissions?page=1&limit=100');
        if (active) setPermissions(result.items);
      } catch {
        // Picker can be empty; the tree still renders.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const flat = useMemo(() => (data ? flatten(data.items) : []), [data]);
  const forbiddenParents = useMemo(
    () => (editingId && data ? descendantsOf(data.items, editingId) : new Set<string>()),
    [editingId, data],
  );

  const visibleIds = useMemo(() => {
    const visible = new Set<string>();
    if (!data) return visible;
    for (const node of flatten(data.items)) {
      const keys = node.permissions ?? [];
      if (keys.length > 0 && keys.some((key) => canonicalPermissions.includes(key))) {
        visible.add(node.id);
      }
    }
    // A child is hidden when any ancestor is hidden.
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

  function handleError(err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        clearToken();
        router.replace('/login');
        return;
      }
      if (err.status === 403) {
        setToast({ type: 'error', text: 'Anda tidak punya izin untuk aksi ini' });
        return;
      }
      if (err.status === 409) {
        setToast({ type: 'error', text: 'Data sudah dipakai' });
        return;
      }
    }
    setToast({ type: 'error', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
  }

  function openCreate(parentId = '') {
    setEditingId(null);
    setForm({ ...emptyForm, parentId });
  }

  async function openEdit(node: MenuNode) {
    // Backend returns permission KEYS in MenuNode; the API expects permission IDs.
    let catalog = permissions;
    if (catalog.length === 0) {
      try {
        const result = await apiPage<PermissionView>('/admin/permissions?page=1&limit=100');
        catalog = result.items;
        setPermissions(catalog);
      } catch {
        catalog = [];
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
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
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(node: MenuNode) {
    setDialog({
      title: 'Hapus menu?',
      text: `Menu "${node.name}" akan dihapus. Anak menjadi root.`,
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
            handleError(err);
          }
        })();
      },
    });
  }

  async function showDetail(node: MenuNode) {
    try {
      setDetail(await api<MenuNode>(`/admin/menus/${node.id}`));
    } catch (err) {
      handleError(err);
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
      <div key={node.id} className="space-y-2">
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-3"
          style={{ marginLeft: depth * 20 }}
        >
          <div>
            <p className="font-medium">{node.name}</p>
            <p className="text-xs text-gray-500">
              {node.url ?? 'group'} · urutan {node.order} ·{' '}
              <span className={visibleIds.has(node.id) ? 'text-green-700' : 'text-amber-600'}>
                {visibleIds.has(node.id) ? 'terlihat' : 'tersembunyi'}
              </span>
            </p>
            <p className="text-xs text-gray-400">
              permission: {node.permissions.join(', ') || 'tidak ada'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <button onClick={() => showDetail(node)} className="text-blue-600 underline">
              Detail
            </button>
            {has('create:menu') && (
              <button onClick={() => openCreate(node.id)} className="text-blue-600 underline">
                Submenu
              </button>
            )}
            {has('update:menu') && (
              <button onClick={() => openEdit(node)} className="text-blue-600 underline">
                Edit
              </button>
            )}
            {has('delete:menu') && (
              <button onClick={() => requestDelete(node)} className="text-red-600 underline">
                Hapus
              </button>
            )}
          </div>
        </div>
        {node.children.length > 0 && renderTree(node.children, depth + 1)}
      </div>
    ));
  }

  if (!has('read:menu')) {
    return <p className="p-6 text-red-600">Anda tidak memiliki akses read:menu.</p>;
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Menu</h1>
          <p className="text-sm text-gray-500">
            Struktur menu, hierarchy, dan permission mapping (ANY-of).
          </p>
        </div>
        {has('create:menu') && (
          <button onClick={() => openCreate()} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
            Tambah menu
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">{editingId ? 'Edit menu' : 'Menu baru'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Nama"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
            <input
              placeholder="URL (/path, kosong untuk group)"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
            <input
              placeholder="Icon (pi pi-users)"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
            <input
              type="number"
              placeholder="Urutan"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
            <select
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            >
              <option value="">Tidak ada parent</option>
              {flat
                .filter((node) => !forbiddenParents.has(node.id))
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
            </select>
            <input
              placeholder="Deskripsi"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Aktif
          </label>

          <div>
            <p className="mb-1 text-sm text-gray-500">Permission (ANY-of)</p>
            <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
              {permissions.map((permission) => (
                <label key={permission.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.permissionIds.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                  />
                  {permission.key}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              {busy ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded border border-gray-300 px-3 py-1 text-sm"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {detail && (
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Detail menu</h2>
            <button onClick={() => setDetail(null)} className="text-sm text-gray-500 underline">
              Tutup
            </button>
          </div>
          <p className="mt-2 text-sm">Nama: {detail.name}</p>
          <p className="text-sm">URL: {detail.url ?? '-'}</p>
          <p className="text-sm">Icon: {detail.icon ?? '-'}</p>
          <p className="text-sm">Parent: {detail.parentId ?? '-'}</p>
          <p className="text-sm">Permission: {detail.permissions.join(', ') || '-'}</p>
        </div>
      )}

      <div className="rounded-xl bg-white p-4 shadow">
        {!data ? (
          <LoadingState />
        ) : data.items.length === 0 ? (
          <EmptyState text="Belum ada menu. Buat menu pertama dengan permission read:menu agar muncul di sidebar." />
        ) : (
          <div className="space-y-2">{renderTree(data.items)}</div>
        )}
      </div>
    </div>
  );
}
