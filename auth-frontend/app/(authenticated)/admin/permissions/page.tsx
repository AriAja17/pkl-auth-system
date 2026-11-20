'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiPage, ApiError, clearToken } from '@/lib/api';
import type { Page, PermissionView } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  Pagination,
  Toast,
  type ToastState,
} from '../_components/ui';

type Drift = { orphan: string[]; unregistered: string[] };
type FormState = { key: string; description: string; isProtected: boolean };

const emptyForm: FormState = { key: '', description: '', isProtected: false };
const CANONICAL = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;

export default function PermissionsPage() {
  const { has, me } = useAuth();
  const router = useRouter();
  const isSystemActor = Boolean(me?.roles?.some((role) => role.isSystem));

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Page<PermissionView> | null>(null);
  const [drift, setDrift] = useState<Drift | null>(null);
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
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setData(
      await apiPage<PermissionView>(
        `/admin/permissions?page=${page}&limit=10&search=${encodeURIComponent(query)}`,
      ),
    );
    setDrift(await api<Drift>('/admin/permissions/drift'));
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
        setToast({ type: 'error', text: 'Permission key sudah terdaftar' });
        return;
      }
    }
    setToast({ type: 'error', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function openEdit(permission: PermissionView) {
    setEditingId(permission.id);
    setForm({
      key: permission.key,
      description: permission.description ?? '',
      isProtected: permission.isProtected,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!editingId && !CANONICAL.test(form.key)) {
      setToast({ type: 'error', text: 'Key harus berformat action:resource' });
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await api(`/admin/permissions/${editingId}`, {
          method: 'PATCH',
          body: {
            description: form.description || null,
            ...(isSystemActor ? { isProtected: form.isProtected } : {}),
          },
        });
      } else {
        await api('/admin/permissions', {
          method: 'POST',
          body: {
            key: form.key,
            description: form.description || undefined,
            ...(isSystemActor ? { isProtected: form.isProtected } : {}),
          },
        });
      }
      setToast({ type: 'ok', text: editingId ? 'Permission diperbarui' : 'Permission dibuat' });
      setForm(null);
      setEditingId(null);
      await load();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(permission: PermissionView) {
    setDialog({
      title: 'Hapus permission?',
      text: `${permission.key} akan dihapus jika tidak dipakai role/menu/delegasi.`,
      confirmLabel: 'Ya, hapus',
      danger: true,
      onConfirm: () => {
        setDialog(null);
        void (async () => {
          try {
            await api(`/admin/permissions/${permission.id}`, { method: 'DELETE' });
            setToast({ type: 'ok', text: 'Permission dihapus' });
            await load();
          } catch (err) {
            handleError(err);
          }
        })();
      },
    });
  }

  if (!has('read:permission')) {
    return <p className="p-6 text-red-600">Anda tidak memiliki akses read:permission.</p>;
  }

  const driftCount = drift ? drift.orphan.length + drift.unregistered.length : 0;

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Permission</h1>
          <p className="text-sm text-gray-500">
            Katalog permission kanonik `action:resource` dari database.
          </p>
        </div>
        {has('create:permission') && (
          <button onClick={openCreate} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
            Tambah permission
          </button>
        )}
      </div>

      {drift && driftCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Drift terdeteksi ({driftCount})</p>
          {drift.orphan.length > 0 && (
            <p className="mt-1">Tanpa endpoint: {drift.orphan.join(', ')}</p>
          )}
          {drift.unregistered.length > 0 && (
            <p className="mt-1">Endpoint tanpa permission: {drift.unregistered.join(', ')}</p>
          )}
        </div>
      )}

      {form && (
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold">{editingId ? 'Edit permission' : 'Permission baru'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="action:resource"
              value={form.key}
              disabled={Boolean(editingId)}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm disabled:bg-gray-100"
            />
            <input
              placeholder="Deskripsi"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded border border-gray-300 p-2 text-sm"
            />
          </div>
          {isSystemActor && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isProtected}
                onChange={(e) => setForm({ ...form, isProtected: e.target.checked })}
              />
              Protected
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
            placeholder="Cari permission key"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-gray-300 p-2 text-sm"
          />
          <button className="rounded bg-gray-800 px-3 py-2 text-sm text-white">Cari</button>
        </form>

        {!data ? (
          <LoadingState />
        ) : data.items.length === 0 ? (
          <EmptyState text="Belum ada permission." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2">Key</th>
                    <th className="py-2">Deskripsi</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Role</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((permission) => (
                    <tr key={permission.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{permission.key}</td>
                      <td className="py-2 text-gray-500">{permission.description ?? '-'}</td>
                      <td className="py-2">
                        {permission.isProtected ? (
                          <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">
                            protected
                          </span>
                        ) : (
                          <span className="text-gray-400">biasa</span>
                        )}
                      </td>
                      <td className="py-2">{permission.roles.join(', ') || '-'}</td>
                      <td className="py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-3">
                          {has('update:permission') && (
                            <button
                              onClick={() => openEdit(permission)}
                              className="text-blue-600 underline"
                            >
                              Edit
                            </button>
                          )}
                          {has('delete:permission') && (
                            <button
                              onClick={() => requestDelete(permission)}
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
