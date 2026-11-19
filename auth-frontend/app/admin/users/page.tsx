'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiPage, ApiError, clearToken } from '@/lib/api';
import type { Page, RoleDetail, UserView } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  Pagination,
  Toast,
  type ToastState,
} from '../_components/ui';

type FormState = {
  username: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  isActive: boolean;
  roleIds: string[];
};

const emptyForm: FormState = {
  username: '',
  name: '',
  email: '',
  phone: '',
  password: '',
  isActive: true,
  roleIds: [],
};

export default function UsersPage() {
  const { has } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Page<UserView> | null>(null);
  const [roles, setRoles] = useState<RoleDetail[]>([]);
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
  const [detail, setDetail] = useState<UserView | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await apiPage<UserView>(
      `/admin/users?page=${page}&limit=10&search=${encodeURIComponent(query)}`,
    );
    setData(result);
  }, [page, query]);

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
        const result = await apiPage<RoleDetail>('/admin/roles?page=1&limit=100');
        if (active) setRoles(result.items.filter((role) => !role.isSystem));
      } catch {
        // Role list is only used by the picker; the page still works without it.
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
        setToast({ type: 'error', text: 'Data sudah terdaftar / masih dipakai' });
        return;
      }
    }
    setToast({ type: 'error', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function openEdit(user: UserView) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      name: user.name ?? '',
      email: user.email,
      phone: user.phone ?? '',
      password: '',
      isActive: user.isActive,
      roleIds: user.roles.map((role) => role.id),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      if (editingId) {
        await api(`/admin/users/${editingId}`, {
          method: 'PATCH',
          body: {
            name: form.name || null,
            phone: form.phone || null,
            isActive: form.isActive,
          },
        });
        await api(`/admin/users/${editingId}/roles`, {
          method: 'PUT',
          body: { roleIds: form.roleIds },
        });
      } else {
        if (!form.email || form.password.length < 6) {
          setToast({ type: 'error', text: 'Email wajib diisi dan password minimal 6 karakter' });
          return;
        }
        await api('/admin/users', {
          method: 'POST',
          body: {
            email: form.email,
            password: form.password,
            ...(form.username ? { username: form.username } : {}),
            ...(form.name ? { name: form.name } : {}),
            ...(form.phone ? { phone: form.phone } : {}),
            roleIds: form.roleIds,
          },
        });
      }
      setToast({ type: 'ok', text: editingId ? 'User diperbarui' : 'User dibuat' });
      setForm(null);
      setEditingId(null);
      await load();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: UserView) {
    try {
      await api(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: { isActive: !user.isActive },
      });
      setToast({ type: 'ok', text: user.isActive ? 'User dinonaktifkan' : 'User diaktifkan' });
      await load();
    } catch (err) {
      handleError(err);
    }
  }

  function requestDelete(user: UserView) {
    setDialog({
      title: 'Hapus user?',
      text: `Akun ${user.email} akan dihapus permanen.`,
      confirmLabel: 'Ya, hapus',
      danger: true,
      onConfirm: () => {
        setDialog(null);
        void (async () => {
          try {
            await api(`/admin/users/${user.id}`, { method: 'DELETE' });
            setToast({ type: 'ok', text: 'User dihapus' });
            await load();
          } catch (err) {
            handleError(err);
          }
        })();
      },
    });
  }

  async function showDetail(user: UserView) {
    try {
      setDetail(await api<UserView>(`/admin/users/${user.id}`));
    } catch (err) {
      handleError(err);
    }
  }

  function toggleRole(id: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            roleIds: current.roleIds.includes(id)
              ? current.roleIds.filter((roleId) => roleId !== id)
              : [...current.roleIds, id],
          }
        : current,
    );
  }

  if (!has('read:user')) {
    return <p className="p-6 text-red-600">Anda tidak memiliki akses read:user.</p>;
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">User</h1>
          <p className="text-sm text-gray-500">Kelola akun, multi-role, dan status aktif.</p>
        </div>
        {has('create:user') && (
          <button
            onClick={openCreate}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
          >
            Tambah user
          </button>
        )}
      </div>

      {form && (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-xl bg-white p-4 shadow"
        >
          <h2 className="font-semibold">{editingId ? 'Edit user' : 'User baru'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              disabled={Boolean(editingId)}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm disabled:bg-gray-100"
            />
            <input
              placeholder="Username (opsional)"
              value={form.username}
              disabled={Boolean(editingId)}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm disabled:bg-gray-100"
            />
            <input
              placeholder="Nama"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
            <input
              placeholder="Telepon"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
            {!editingId && (
              <input
                placeholder="Password (min. 6)"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="rounded border border-gray-300 p-2 text-sm"
              />
            )}
          </div>

          {roles.length > 0 && (
            <div>
              <p className="mb-1 text-sm text-gray-500">Role</p>
              <div className="grid gap-1 sm:grid-cols-3">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.roleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    {role.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {editingId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Aktif
            </label>
          )}

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
            <h2 className="font-semibold">Detail user</h2>
            <button onClick={() => setDetail(null)} className="text-sm text-gray-500 underline">
              Tutup
            </button>
          </div>
          <p className="mt-2 text-sm">Email: {detail.email}</p>
          <p className="text-sm">Username: {detail.username}</p>
          <p className="text-sm">Nama: {detail.name ?? '-'}</p>
          <p className="text-sm">Status: {detail.isActive ? 'Aktif' : 'Nonaktif'}</p>
          <p className="text-sm">
            Role: {detail.roles.map((role) => role.name).join(', ') || 'Tanpa role'}
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
            placeholder="Cari email/username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-gray-300 p-2 text-sm"
          />
          <button className="rounded bg-gray-800 px-3 py-2 text-sm text-white">Cari</button>
        </form>

        {!data ? (
          <LoadingState />
        ) : data.items.length === 0 ? (
          <EmptyState text="Belum ada user." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2">User</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="py-2">
                        <p className="font-medium">{user.username}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </td>
                      <td className="py-2">
                        {user.roles.map((role) => role.name).join(', ') || 'Tanpa role'}
                      </td>
                      <td className="py-2">
                        <span
                          className={
                            user.isActive ? 'text-green-700' : 'text-amber-600'
                          }
                        >
                          {user.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-3">
                          <button onClick={() => showDetail(user)} className="text-blue-600 underline">
                            Detail
                          </button>
                          {has('update:user') && (
                            <>
                              <button onClick={() => openEdit(user)} className="text-blue-600 underline">
                                Edit
                              </button>
                              <button
                                onClick={() => toggleActive(user)}
                                className="text-amber-600 underline"
                              >
                                {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                            </>
                          )}
                          {has('delete:user') && (
                            <button
                              onClick={() => requestDelete(user)}
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
