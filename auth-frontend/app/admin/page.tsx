'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, clearToken, getToken } from '@/lib/api';

type Me = { id: string; email: string; role: string | null; permissions: string[] };
type User = { id: string; email: string; role: { id: string; name: string } | null };
type Role = { id: string; name: string; permissions: string[] };
type Permission = { id: string; key: string };
type Toast = { type: 'ok' | 'error'; text: string };
type DialogState = {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
};

const PROTECTED_ROLE = 'Admin';
const PROTECTED_PERMISSION = 'user.manage';

// Nama yang mudah dibaca untuk tiap permission (hanya tampilan)
const PERMISSION_LABELS: Record<string, string> = {
  'article.read': 'Melihat artikel',
  'article.create': 'Membuat artikel',
  'article.update': 'Mengedit artikel',
  'article.delete': 'Menghapus artikel',
  'user.manage': 'Mengelola user dan role',
};

function labelOf(key: string) {
  return PERMISSION_LABELS[key] ?? key;
}

function toggle(list: string[], key: string) {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

function PermissionPicker({
  options,
  selected,
  onToggle,
}: {
  options: Permission[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {options.map((p) => (
        <label key={p.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(p.key)}
            onChange={() => onToggle(p.key)}
          />
          {labelOf(p.key)}
        </label>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string[]>([]);

  const loadAll = useCallback(async () => {
    const [u, r, p] = await Promise.all([
      api<User[]>('/admin/users'),
      api<Role[]>('/admin/roles'),
      api<Permission[]>('/admin/permissions'),
    ]);
    setUsers(u);
    setRoles(r);
    setPermissions(p);
  }, []);

  // Notifikasi hilang sendiri setelah 4 detik
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    api<Me>('/auth/me')
      .then(async (m) => {
        if (!m.permissions.includes('user.manage')) {
          router.replace('/dashboard');
          return;
        }
        setMe(m);
        await loadAll();
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace('/login');
        } else {
          setToast({ type: 'error', text: err.message });
        }
      });
  }, [router, loadAll]);

  function handleError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
      router.replace('/login');
      return;
    }
    setToast({
      type: 'error',
      text: err instanceof Error ? err.message : 'Terjadi kesalahan',
    });
  }

  async function run(action: () => Promise<unknown>, successText: string) {
    try {
      await action();
      await loadAll();
      setToast({ type: 'ok', text: successText });
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  }

  // ---------- Aksi user ----------

  function requestChangeRole(user: User, roleId: string) {
    const newName = roleId ? roles.find((r) => r.id === roleId)?.name : null;
    setDialog({
      title: 'Ubah role user?',
      text: newName
        ? `Role ${user.email} akan diubah menjadi ${newName}.`
        : `Role ${user.email} akan dicabut. Akun ini menjadi tanpa akses.`,
      confirmLabel: 'Ya, ubah',
      onConfirm: () => {
        if (roleId === '') {
          run(
            () => api(`/admin/users/${user.id}/role`, { method: 'DELETE' }),
            `Role ${user.email} berhasil dicabut`,
          );
        } else {
          run(
            () => api(`/admin/users/${user.id}/role`, { method: 'PUT', body: { roleId } }),
            `Role ${user.email} berhasil diubah menjadi ${newName}`,
          );
        }
      },
    });
  }

  function requestDeleteUser(user: User) {
    setDialog({
      title: 'Hapus user?',
      text: `Akun ${user.email} akan dihapus permanen dan tidak bisa dikembalikan.`,
      confirmLabel: 'Ya, hapus',
      danger: true,
      onConfirm: () => {
        run(
          () => api(`/admin/users/${user.id}`, { method: 'DELETE' }),
          `User ${user.email} berhasil dihapus`,
        );
      },
    });
  }

  // ---------- Aksi role ----------

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    const name = newRoleName.trim();
    if (!name) {
      setToast({ type: 'error', text: 'Nama role wajib diisi' });
      return;
    }
    const ok = await run(
      () => api('/admin/roles', { method: 'POST', body: { name, permissions: newRolePerms } }),
      `Role ${name} berhasil dibuat`,
    );
    if (ok) {
      setNewRoleName('');
      setNewRolePerms([]);
    }
  }

  function startEdit(role: Role) {
    setEditingRoleId(role.id);
    setEditDraft(role.permissions.filter((k) => k !== PROTECTED_PERMISSION));
  }

  async function saveEdit(role: Role) {
    const ok = await run(
      () =>
        api(`/admin/roles/${role.id}/permissions`, {
          method: 'PUT',
          body: { permissions: editDraft },
        }),
      `Izin role ${role.name} berhasil disimpan`,
    );
    if (ok) setEditingRoleId(null);
  }

  function requestDeleteRole(role: Role) {
    setDialog({
      title: 'Hapus role?',
      text: `Role ${role.name} akan dihapus permanen.`,
      confirmLabel: 'Ya, hapus',
      danger: true,
      onConfirm: () => {
        run(
          () => api(`/admin/roles/${role.id}`, { method: 'DELETE' }),
          `Role ${role.name} berhasil dihapus`,
        );
      },
    });
  }

  // ---------- Tampilan ----------

  if (!me) {
    return (
      <p className="p-6 text-gray-500">{toast ? toast.text : 'Memuat...'}</p>
    );
  }

  const allKeys = permissions.map((p) => p.key);
  const assignablePermissions = permissions.filter(
    (p) => p.key !== PROTECTED_PERMISSION,
  );
  const assignableRoles = roles.filter((r) => r.name !== PROTECTED_ROLE);

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900">
      {/* Notifikasi mengambang */}
      {toast && (
        <div
          role="status"
          className={`fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          <span className="font-bold">
            {toast.type === 'ok' ? 'Berhasil' : 'Gagal'}
          </span>
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Tutup">
            x
          </button>
        </div>
      )}

      {/* Dialog konfirmasi */}
      {dialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{dialog.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{dialog.text}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDialog(null)}
                className="rounded border border-gray-300 px-3 py-1 text-sm"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const action = dialog.onConfirm;
                  setDialog(null);
                  action();
                }}
                className={`rounded px-3 py-1 text-sm text-white ${
                  dialog.danger ? 'bg-red-600' : 'bg-blue-600'
                }`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Halaman Admin</h1>
          <Link href="/dashboard" className="text-sm text-blue-600 underline">
            Kembali ke dashboard
          </Link>
        </div>

        {/* ---------- Bagian 1: User ---------- */}
        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-3 text-lg font-semibold">User</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === me.id;
                  const locked = isSelf || u.role?.name === PROTECTED_ROLE;
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2">
                        {u.email}
                        {isSelf && (
                          <span className="ml-2 text-xs text-gray-400">(kamu)</span>
                        )}
                      </td>
                      <td className="py-2">
                        {locked ? (
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                            {u.role?.name ?? 'Tanpa role'}
                          </span>
                        ) : (
                          <select
                            value={u.role?.id ?? ''}
                            onChange={(e) => requestChangeRole(u, e.target.value)}
                            className="rounded border border-gray-300 bg-white p-1"
                          >
                            <option value="">Tanpa role</option>
                            {assignableRoles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {!locked && (
                          <button
                            onClick={() => requestDeleteUser(u)}
                            className="text-sm text-red-600 underline"
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- Bagian 2: Role ---------- */}
        <section className="space-y-4 rounded-xl bg-white p-4 shadow">
          <h2 className="text-lg font-semibold">Role</h2>

          {/* Buat role baru */}
          <form
            onSubmit={createRole}
            className="space-y-3 rounded border border-dashed border-gray-300 p-3"
          >
            <h3 className="font-medium">Buat role baru</h3>
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Nama role, contoh: Moderator"
              className="w-full rounded border border-gray-300 p-2 text-sm"
            />
            <div>
              <p className="mb-1 text-sm text-gray-500">
                Centang hal yang boleh dilakukan role ini. Yang tidak dicentang
                berarti tidak boleh.
              </p>
              <PermissionPicker
                options={assignablePermissions}
                selected={newRolePerms}
                onToggle={(key) => setNewRolePerms((l) => toggle(l, key))}
              />
            </div>
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              Buat role
            </button>
          </form>

          {/* Daftar role */}
          {roles.map((role) => {
            const isAdminRole = role.name === PROTECTED_ROLE;
            const allowed = isAdminRole ? allKeys : role.permissions;
            const denied = allKeys.filter((k) => !allowed.includes(k));
            const editing = editingRoleId === role.id;

            return (
              <div key={role.id} className="rounded border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {role.name}
                    {isAdminRole && (
                      <span className="ml-2 text-xs text-gray-400">
                        bawaan sistem
                      </span>
                    )}
                  </h3>
                  {!isAdminRole && !editing && (
                    <div className="flex gap-3 text-sm">
                      <button
                        onClick={() => startEdit(role)}
                        className="text-blue-600 underline"
                      >
                        Ubah izin
                      </button>
                      <button
                        onClick={() => requestDeleteRole(role)}
                        className="text-red-600 underline"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>

                {editing ? (
                  <div className="mt-3 space-y-3">
                    <PermissionPicker
                      options={assignablePermissions}
                      selected={editDraft}
                      onToggle={(key) => setEditDraft((l) => toggle(l, key))}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(role)}
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={() => setEditingRoleId(null)}
                        className="rounded border border-gray-300 px-3 py-1 text-sm"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      <span className="font-medium text-green-700">Boleh:</span>{' '}
                      {allowed.length ? allowed.map(labelOf).join(', ') : 'tidak ada'}
                    </p>
                    <p>
                      <span className="font-medium text-red-700">Tidak boleh:</span>{' '}
                      {denied.length ? denied.map(labelOf).join(', ') : 'tidak ada'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}