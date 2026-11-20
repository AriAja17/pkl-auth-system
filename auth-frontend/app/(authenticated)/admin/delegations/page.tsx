'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiPage, ApiError, clearToken } from '@/lib/api';
import type { DelegationView, Page, PermissionView, UserView } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  Pagination,
  Toast,
  type ToastState,
} from '../_components/ui';

type FormState = { granteeId: string; permissionKeys: string[]; expiresAt: string };

const emptyForm: FormState = { granteeId: '', permissionKeys: [], expiresAt: '' };

export default function DelegationsPage() {
  const { has, me } = useAuth();
  const isSystemActor = Boolean(me?.roles?.some((role) => role.isSystem));
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [granteeFilter, setGranteeFilter] = useState('');
  const [data, setData] = useState<Page<DelegationView> | null>(null);
  const [users, setUsers] = useState<UserView[]>([]);
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
  const [detail, setDetail] = useState<DelegationView | null>(null);
  const [revokedIds, setRevokedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const userNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) map.set(user.id, user.username ?? user.email);
    return map;
  }, [users]);

  const load = useCallback(async () => {
    const suffix = granteeFilter ? `&granteeId=${granteeFilter}` : '';
    setData(await apiPage<DelegationView>(`/admin/delegations?page=${page}&limit=10${suffix}`));
  }, [page, granteeFilter]);

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
        const [userPage, permissionPage] = await Promise.all([
          apiPage<UserView>('/admin/users?page=1&limit=100'),
          apiPage<PermissionView>('/admin/permissions?page=1&limit=100'),
        ]);
        if (active) {
          setUsers(userPage.items);
          setPermissions(permissionPage.items);
        }
      } catch {
        // Pickers can be empty without blocking the list.
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
        setToast({ type: 'error', text: 'Delegasi sudah diberikan ke user ini' });
        return;
      }
    }
    setToast({ type: 'error', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
  }

  function openCreate() {
    setForm(emptyForm);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const expires = new Date(form.expiresAt);
    if (!form.granteeId || form.permissionKeys.length === 0 || Number.isNaN(expires.getTime())) {
      setToast({ type: 'error', text: 'Grantee, permission, dan expired date wajib diisi' });
      return;
    }
    setBusy(true);
    try {
      await api('/admin/delegations', {
        method: 'POST',
        body: {
          granteeId: form.granteeId,
          permissionKeys: form.permissionKeys,
          expiresAt: expires.toISOString(),
        },
      });
      setToast({ type: 'ok', text: 'Delegasi dibuat' });
      setForm(null);
      await load();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  function requestRevoke(item: DelegationView) {
    setDialog({
      title: 'Cabut delegasi?',
      text: `Capability ${item.permissionKey} untuk ${userNames.get(item.granteeId) ?? item.granteeId} akan dicabut beserta turunannya.`,
      confirmLabel: 'Ya, cabut',
      danger: true,
      onConfirm: () => {
        setDialog(null);
        void (async () => {
          try {
            const result = await api<{ invalidatedDescendantIds: string[] }>(
              `/admin/delegations/${item.id}`,
              { method: 'DELETE' },
            );
            setRevokedIds(result.invalidatedDescendantIds ?? []);
            setToast({ type: 'ok', text: 'Delegasi dicabut' });
            await load();
          } catch (err) {
            handleError(err);
          }
        })();
      },
    });
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

  if (!has('read:delegation')) {
    return <p className="p-6 text-red-600">Anda tidak memiliki akses read:delegation.</p>;
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Delegasi</h1>
          <p className="text-sm text-gray-500">
            AdminCapability, batasan capability, dan validasi lineage.
          </p>
        </div>
        {has('create:delegation') && (
          <button onClick={openCreate} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
            Buat delegasi
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">Delegasi baru</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={form.granteeId}
              onChange={(e) => setForm({ ...form, granteeId: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            >
              <option value="">Pilih grantee</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} — {user.email}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
          </div>
          <p className="text-xs text-gray-500">
            Maksimal 90 hari. Parent capability ditentukan otomatis oleh server.
          </p>
          <div>
            <p className="mb-1 text-sm text-gray-500">Permission</p>
            <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
              {permissions
                .filter(
                  (permission) =>
                    permission.key !== 'grant:admin' &&
                    (permission.key !== 'create:delegation' || isSystemActor),
                )
                .map((permission) => (
                  <label key={permission.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.permissionKeys.includes(permission.key)}
                      onChange={() => togglePermission(permission.key)}
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
            <h2 className="font-semibold">Detail delegasi</h2>
            <button onClick={() => setDetail(null)} className="text-sm text-gray-500 underline">
              Tutup
            </button>
          </div>
          <p className="mt-2 text-sm">Grantee: {userNames.get(detail.granteeId) ?? detail.granteeId}</p>
          <p className="text-sm">Grantor: {userNames.get(detail.grantedBy) ?? detail.grantedBy}</p>
          <p className="text-sm">Permission: {detail.permissionKey}</p>
          <p className="text-sm">Parent: {detail.parentCapabilityId ?? 'root'}</p>
          <p className="text-sm">Diberikan: {new Date(detail.grantedAt).toLocaleString('id-ID')}</p>
          <p className="text-sm">Expired: {new Date(detail.expiresAt).toLocaleString('id-ID')}</p>
          <p className="text-sm">Status: {detail.valid ? 'valid' : 'tidak valid'}</p>
        </div>
      )}

      {revokedIds.length > 0 && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
          Descendant yang ikut dicabut: {revokedIds.join(', ')}
        </p>
      )}

      <div className="rounded-xl bg-white p-4 shadow">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
          className="mb-3 flex flex-wrap gap-2"
        >
          <select
            value={granteeFilter}
            onChange={(e) => setGranteeFilter(e.target.value)}
            className="rounded border border-gray-300 p-2 text-sm"
          >
            <option value="">Semua grantee</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
          <button className="rounded bg-gray-800 px-3 py-2 text-sm text-white">Filter</button>
        </form>

        {!data ? (
          <LoadingState />
        ) : data.items.length === 0 ? (
          <EmptyState text="Belum ada delegasi." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2">Grantee</th>
                    <th className="py-2">Permission</th>
                    <th className="py-2">Grantor</th>
                    <th className="py-2">Expired</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2">{userNames.get(item.granteeId) ?? item.granteeId}</td>
                      <td className="py-2">{item.permissionKey}</td>
                      <td className="py-2">{userNames.get(item.grantedBy) ?? item.grantedBy}</td>
                      <td className="py-2">{new Date(item.expiresAt).toLocaleString('id-ID')}</td>
                      <td className="py-2">
                        <span className={item.valid ? 'text-green-700' : 'text-red-600'}>
                          {item.valid ? 'valid' : 'tidak valid'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-3">
                          <button
                            onClick={() => setDetail(item)}
                            className="text-blue-600 underline"
                          >
                            Detail
                          </button>
                          {has('delete:delegation') && (
                            <button
                              onClick={() => requestRevoke(item)}
                              className="text-red-600 underline"
                            >
                              Cabut
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
