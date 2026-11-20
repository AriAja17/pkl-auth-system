'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiPage, ApiError, clearToken } from '@/lib/api';
import type { Page, PermissionView, RoleDetail } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  Pagination,
  Toast,
  type ToastState,
} from '../_components/ui';

type FormState = { name: string; description: string; permissionKeys: string[] };

const emptyForm: FormState = { name: '', description: '', permissionKeys: [] };

export default function RolesPage() {
  const { has, me } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Page<RoleDetail> | null>(null);
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
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const isSystemActor = Boolean(me?.roles?.some((role) => role.isSystem));

  const load = useCallback(async () => {
    return apiPage<RoleDetail>(
      `/admin/roles?page=${page}&limit=10&search=${encodeURIComponent(query)}`,
    );
  }, [page, query]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await load();
        if (active) setData(result);
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
        // Permission picker is optional; show the rest of the page regardless.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
        setToast({ type: 'error', text: 'Nama role sudah dipakai' });
        return;
      }
    }
    setToast({ type: 'error', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function openEdit(role: RoleDetail) {
    setEditingId(role.id);
    setForm({
      name: role.name,
      description: role.description ?? '',
      permissionKeys: [...role.permissions],
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      if (editingId) {
        await api(`/admin/roles/${editingId}`, {
          method: 'PATCH',
          body: { name: form.name, description: form.description || null },
        });
        await api(`/admin/roles/${editingId}/permissions`, {
          method: 'PUT',
          body: { permissionKeys: form.permissionKeys },
        });
      } else {
        await api('/admin/roles', {
          method: 'POST',
          body: {
            name: form.name,
            description: form.description || undefined,
            permissionKeys: form.permissionKeys,
          },
        });
      }
      setToast({ type: 'ok', text: editingId ? 'Role diperbarui' : 'Role dibuat' });
      setForm(null);
      setEditingId(null);
      await load().then(setData);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(role: RoleDetail) {
    setDialog({
      title: 'Hapus role?',
      text: `Role ${role.name} akan dihapus permanen.`,
      confirmLabel: 'Ya, hapus',
      danger: true,
      onConfirm: () => {
        setDialog(null);
        void (async () => {
          try {
            await api(`/admin/roles/${role.id}`, { method: 'DELETE' });
            setToast({ type: 'ok', text: 'Role dihapus' });
            await load().then(setData);
          } catch (err) {
            handleError(err);
          }
        })();
      },
    });
  }

  async function showDetail(role: RoleDetail) {
    try {
      setDetail(await api<RoleDetail>(`/admin/roles/${role.id}`));
    } catch (err) {
      handleError(err);
    }
  }

  function togglePermission(key: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            permissionKeys: current.permissionKeys.includes(key)
              ? current.permissionKeys.filter((value) => value !== key)
              : [...current.permissionKeys, key],
          }
        : current,
    );
  }

  if (!has('read:role')) {
    return <p className="p-6 text-red-600">Anda tidak memiliki akses read:role.</p>;
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Role</h1>
          <p className="text-sm text-gray-500">
            Kelola role dan assignment permission dengan key kanonik.
          </p>
        </div>
        {has('create:role') && (
          <button
            onClick={openCreate}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
          >
            Tambah role
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">{editingId ? 'Edit role' : 'Role baru'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Nama role"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
            <input
              placeholder="Deskripsi"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
          </div>
          <div>
            <p className="mb-1 text-sm text-gray-500">Permission (action:resource)</p>
            <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
              {permissions.map((permission) => {
                const locked = permission.isProtected && !isSystemActor;
                return (
                  <label
                    key={permission.id}
                    className={`flex items-center gap-2 text-sm ${locked ? 'text-gray-400' : ''}`}
                  >
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={form.permissionKeys.includes(permission.key)}
                      onChange={() => togglePermission(permission.key)}
                    />
                    {permission.key}
                    {permission.isProtected && (
                      <span className="rounded bg-amber-100 px-1 text-xs text-amber-700">
                        protected
                      </span>
                    )}
                  </label>
                );
              })}
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
            <h2 className="font-semibold">Detail role</h2>
            <button onClick={() => setDetail(null)} className="text-sm text-gray-500 underline">
              Tutup
            </button>
          </div>
          <p className="mt-2 text-sm">Nama: {detail.name}</p>
          <p className="text-sm">User: {detail.usersCount}</p>
          <p className="text-sm">
            Permission: {detail.permissions.join(', ') || 'tidak ada'}
          </p>
        </div>
      )}

      <div className="rounded-xl bg-white p-4 shadow">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search);
          }}
          className="mb-3 flex gap-2"
        >
          <input
            placeholder="Cari role"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-gray-300 p-2 text-sm"
          />
          <button className="rounded bg-gray-800 px-3 py-2 text-sm text-white">Cari</button>
        </form>

        {!data ? (
          <LoadingState />
        ) : data.items.length === 0 ? (
          <EmptyState text="Belum ada role." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2">Role</th>
                    <th className="py-2">User</th>
                    <th className="py-2">Permission</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((role) => (
                    <tr key={role.id} className="border-b last:border-0">
                      <td className="py-2">
                        <p className="font-medium">{role.name}</p>
                        {role.isSystem && (
                          <p className="text-xs text-amber-600">
                            Role sistem — tidak bisa diubah/dihapus
                          </p>
                        )}
                      </td>
                      <td className="py-2">{role.usersCount}</td>
                      <td className="py-2">{role.permissions.length}</td>
                      <td className="py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-3">
                          <button onClick={() => showDetail(role)} className="text-blue-600 underline">
                            Detail
                          </button>
                          {!role.isSystem && has('update:role') && (
                            <button onClick={() => openEdit(role)} className="text-blue-600 underline">
                              Edit
                            </button>
                          )}
                          {!role.isSystem && has('delete:role') && (
                            <button
                              onClick={() => requestDelete(role)}
                              className="text-red-600 underline"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <Pagination page={page} limit={10} total={data.total} onPage={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
