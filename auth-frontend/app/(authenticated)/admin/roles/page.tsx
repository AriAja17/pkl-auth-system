'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiPage } from '@/lib/api';
import type { Page, PermissionView, RoleDetail } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import { isSystemActor } from '@/lib/auth-helpers';
import { apiErrorText, handleUnauthorized } from '@/lib/errors';
import {
  Badge,
  Button,
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
import PermissionPicker, { type CatalogState } from '@/components/permission-picker';

type FormState = { name: string; description: string; permissionKeys: string[] };

const emptyForm: FormState = { name: '', description: '', permissionKeys: [] };

export default function RolesPage() {
  const { has, me } = useAuth();
  const systemActor = isSystemActor(me);
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Page<RoleDetail> | null>(null);
  const [loadError, setLoadError] = useState('');
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
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await apiPage<RoleDetail>(
      `/admin/roles?page=${page}&limit=10&search=${encodeURIComponent(query)}`,
    );
    setData(result);
    setLoadError('');
  }, [page, query]);

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
        setLoadError(apiErrorText(err, 'Gagal memuat role.'));
        setToast({ type: 'error', text: apiErrorText(err, 'Gagal memuat role.') });
      }
    })();
    return () => {
      active = false;
    };
  }, [load, router]);

  async function retryLoad() {
    setLoadError('');
    setData(null);
    try {
      await load();
    } catch (err) {
      if (handleUnauthorized(err, router)) return;
      setLoadError(apiErrorText(err, 'Gagal memuat role.'));
    }
  }

  useEffect(() => {
    void (async () => {
      await loadCatalog();
    })();
  }, [loadCatalog]);

  function reportError(err: unknown) {
    if (handleUnauthorized(err, router)) return;
    setToast({ type: 'error', text: apiErrorText(err) });
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

  async function submit() {
    if (!form || catalogState !== 'ready') return;
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
      await load();
    } catch (err) {
      reportError(err);
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
            await load();
          } catch (err) {
            reportError(err);
          }
        })();
      },
    });
  }

  async function showDetail(role: RoleDetail) {
    try {
      setDetail(await api<RoleDetail>(`/admin/roles/${role.id}`));
    } catch (err) {
      reportError(err);
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
    return <EmptyState title="Tidak ada akses" text="Anda tidak memiliki izin read:role." />;
  }

  const lockedKeys = systemActor
    ? []
    : permissions.filter((permission) => permission.isProtected).map((permission) => permission.key);
  const saveDisabled = busy || catalogState !== 'ready';

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <PageHeader
        title="Roles"
        description="Kelola role dan assignment permission dengan key kanonik."
        action={
          has('create:role') ? <Button onClick={openCreate}>Tambah role</Button> : undefined
        }
      />

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
            aria-label="Cari role"
            placeholder="Cari role"
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
          <EmptyState title="Belum ada role" text="Tidak ada role yang cocok." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Role</Th>
                  <Th>User</Th>
                  <Th>Permission</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((role) => (
                  <tr key={role.id} className="hover:bg-canvas">
                    <Td>
                      <p className="font-medium">{role.name}</p>
                      {role.isSystem && (
                        <div className="mt-1">
                          <Badge variant="warning">Role sistem</Badge>
                        </div>
                      )}
                    </Td>
                    <Td className="font-mono text-xs">{role.usersCount}</Td>
                    <Td className="font-mono text-xs">{role.permissions.length}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="link" size="sm" onClick={() => void showDetail(role)}>
                          Detail
                        </Button>
                        {!role.isSystem && has('update:role') && (
                          <Button variant="link" size="sm" onClick={() => openEdit(role)}>
                            Edit
                          </Button>
                        )}
                        {!role.isSystem && has('delete:role') && (
                          <Button
                            variant="link"
                            size="sm"
                            className="text-danger"
                            onClick={() => requestDelete(role)}
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
        title={editingId ? 'Edit role' : 'Role baru'}
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
            <div className="rounded-sm border border-warning bg-warning-surface p-3 text-sm text-warning" role="note">
              Menyimpan akan mengganti seluruh permission yang diberikan kepada role ini.
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama role" htmlFor="role-name" required>
                <Input
                  id="role-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="Deskripsi" htmlFor="role-description">
                <Input
                  id="role-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </Field>
            </div>
            <PermissionPicker
              permissions={permissions}
              selectedKeys={form.permissionKeys}
              onToggle={togglePermission}
              state={catalogState}
              lockedKeys={lockedKeys}
              onRetry={() => {
                setCatalogState('loading');
                void loadCatalog();
              }}
            />
          </div>
        )}
      </Drawer>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detail role"
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
              <dt className="text-xs text-text-muted">Jumlah user</dt>
              <dd className="font-mono">{detail.usersCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Permission</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {detail.permissions.length === 0 ? (
                  <span className="text-text-muted">tidak ada</span>
                ) : (
                  detail.permissions.map((key) => (
                    <Badge key={key} variant="neutral">
                      <span className="font-mono">{key}</span>
                    </Badge>
                  ))
                )}
              </dd>
            </div>
          </dl>
        )}
      </Drawer>
    </div>
  );
}
