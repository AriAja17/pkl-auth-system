'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiPage } from '@/lib/api';
import type { Page, PermissionView } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import { isSystemActor } from '@/lib/auth-helpers';
import { apiErrorText, handleUnauthorized } from '@/lib/errors';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Pagination,
  Table,
  Td,
  Th,
  Toast,
  type ToastState,
} from '@/components/ui';
import PageHeader from '@/components/page-header';

type Drift = { orphan: string[]; unregistered: string[] };
type FormState = { key: string; description: string; isProtected: boolean };

const emptyForm: FormState = { key: '', description: '', isProtected: false };
const CANONICAL = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;

export default function PermissionsPage() {
  const { has, me } = useAuth();
  const systemActor = isSystemActor(me);
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Page<PermissionView> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [drift, setDrift] = useState<Drift | null>(null);
  const [driftError, setDriftError] = useState('');
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
  const [keyError, setKeyError] = useState('');
  const [busy, setBusy] = useState(false);

  // Main catalogue and drift are independent: a drift failure must never hide
  // a successfully loaded permission list.
  const load = useCallback(async () => {
    const result = await apiPage<PermissionView>(
      `/admin/permissions?page=${page}&limit=10&search=${encodeURIComponent(query)}`,
    );
    setData(result);
    setLoadError('');
  }, [page, query]);

  const loadDrift = useCallback(async () => {
    try {
      const result = await api<Drift>('/admin/permissions/drift');
      setDrift(result);
      setDriftError('');
    } catch (err) {
      if (handleUnauthorized(err, router)) return;
      setDrift(null);
      setDriftError(apiErrorText(err, 'Gagal memuat informasi drift.'));
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (active) await load();
      } catch (err) {
        if (!active || handleUnauthorized(err, router)) return;
        setLoadError(apiErrorText(err, 'Gagal memuat katalog permission.'));
        setToast({ type: 'error', text: apiErrorText(err, 'Gagal memuat katalog permission.') });
      }
    })();
    void (async () => {
      await loadDrift();
    })();
    return () => {
      active = false;
    };
  }, [load, loadDrift, router]);

  async function retryLoad() {
    setLoadError('');
    setData(null);
    try {
      await load();
    } catch (err) {
      if (handleUnauthorized(err, router)) return;
      setLoadError(apiErrorText(err, 'Gagal memuat katalog permission.'));
    }
    void loadDrift();
  }

  function reportError(err: unknown) {
    if (handleUnauthorized(err, router)) return;
    setToast({ type: 'error', text: apiErrorText(err) });
  }

  function openCreate() {
    setEditingId(null);
    setKeyError('');
    setForm({ ...emptyForm });
  }

  function openEdit(permission: PermissionView) {
    setEditingId(permission.id);
    setKeyError('');
    setForm({
      key: permission.key,
      description: permission.description ?? '',
      isProtected: permission.isProtected,
    });
  }

  async function submit() {
    if (!form) return;
    if (!editingId && !CANONICAL.test(form.key)) {
      setKeyError('Key harus berformat action:resource');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await api(`/admin/permissions/${editingId}`, {
          method: 'PATCH',
          body: {
            description: form.description || null,
            ...(systemActor ? { isProtected: form.isProtected } : {}),
          },
        });
      } else {
        await api('/admin/permissions', {
          method: 'POST',
          body: {
            key: form.key,
            description: form.description || undefined,
            ...(systemActor ? { isProtected: form.isProtected } : {}),
          },
        });
      }
      setToast({ type: 'ok', text: editingId ? 'Permission diperbarui' : 'Permission dibuat' });
      setForm(null);
      setEditingId(null);
      await load();
    } catch (err) {
      reportError(err);
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
            reportError(err);
          }
        })();
      },
    });
  }

  if (!has('read:permission')) {
    return <EmptyState title="Tidak ada akses" text="Anda tidak memiliki izin read:permission." />;
  }

  const driftCount = drift ? drift.orphan.length + drift.unregistered.length : 0;

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <PageHeader
        title="Permissions"
        description={
          <>
            Katalog permission kanonik{' '}
            <code className="font-mono text-xs">action:resource</code>.
          </>
        }
        action={
          has('create:permission') ? (
            <Button onClick={openCreate}>Tambah permission</Button>
          ) : undefined
        }
      />

      {driftError && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning bg-warning-surface p-3 text-sm text-warning"
        >
          <p>
            {driftError} Daftar permission tetap dapat digunakan.
          </p>
          <Button variant="link" size="sm" onClick={() => void loadDrift()}>
            Coba lagi
          </Button>
        </div>
      )}

      {drift && driftCount > 0 && (
        <div role="status" className="rounded-md border border-warning bg-warning-surface p-4 text-sm text-warning">
          <p className="font-semibold">Drift terdeteksi ({driftCount})</p>
          {drift.orphan.length > 0 && (
            <p className="mt-1">
              Tanpa endpoint: <span className="font-mono">{drift.orphan.join(', ')}</span>
            </p>
          )}
          {drift.unregistered.length > 0 && (
            <p className="mt-1">
              Endpoint tanpa permission: <span className="font-mono">{drift.unregistered.join(', ')}</span>
            </p>
          )}
        </div>
      )}

      <div className="rounded-md border border-border-subtle bg-surface p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQuery(search);
          }}
          className="mb-4 flex flex-wrap gap-2"
        >
          <Input
            aria-label="Cari permission key"
            placeholder="Cari permission key"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="secondary">Cari</Button>
        </form>

        {loadError ? (
          <ErrorState message={loadError} onRetry={() => void retryLoad()} />
        ) : !data ? (
          <LoadingState rows={5} />
        ) : data.items.length === 0 ? (
          <EmptyState title="Belum ada permission" text="Tidak ada permission yang cocok." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Key</Th>
                  <Th>Deskripsi</Th>
                  <Th>Status</Th>
                  <Th>Role</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((permission) => (
                  <tr key={permission.id} className="hover:bg-canvas">
                    <Td className="font-mono text-xs font-medium">{permission.key}</Td>
                    <Td className="text-text-muted">{permission.description ?? '-'}</Td>
                    <Td>
                      <Badge variant={permission.isProtected ? 'warning' : 'neutral'}>
                        {permission.isProtected ? 'protected' : 'biasa'}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-text-secondary">
                      {permission.roles.join(', ') || '-'}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        {has('update:permission') && (
                          <Button variant="link" size="sm" onClick={() => openEdit(permission)}>
                            Edit
                          </Button>
                        )}
                        {has('delete:permission') && (
                          <Button
                            variant="link"
                            size="sm"
                            className="text-danger"
                            onClick={() => requestDelete(permission)}
                          >
                            Hapus
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-4">
              <Pagination page={page} limit={10} total={data.total} onPage={setPage} />
            </div>
          </>
        )}
      </div>

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={editingId ? 'Edit permission' : 'Permission baru'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Batal</Button>
            <Button onClick={() => void submit()} loading={busy}>Simpan</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <Field
              label="Key (action:resource)"
              htmlFor="permission-key"
              error={keyError}
              hint="Contoh: read:project"
              required
            >
              <Input
                id="permission-key"
                value={form.key}
                disabled={Boolean(editingId)}
                invalid={Boolean(keyError)}
                className="font-mono"
                onChange={(event) => {
                  setForm({ ...form, key: event.target.value });
                  setKeyError('');
                }}
              />
            </Field>
            <Field label="Deskripsi" htmlFor="permission-description">
              <Input
                id="permission-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
            {systemActor && (
              <Checkbox
                label="Protected"
                hint="Hanya actor sistem yang dapat mengubah permission protected"
                checked={form.isProtected}
                onChange={(event) => setForm({ ...form, isProtected: event.target.checked })}
              />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
