'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiPage } from '@/lib/api';
import type { Page, RoleDetail, UserView } from '@/lib/api-types';
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
  Pagination,
  Table,
  Td,
  Th,
  Toast,
  type ToastState,
} from '@/components/ui';
import PageHeader from '@/components/page-header';

type FormState = {
  username: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  isActive: boolean;
  roleIds: string[];
};

type FieldErrors = Partial<Record<'email' | 'password', string>>;

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
  const { has, me } = useAuth();
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
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserView | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setData(
      await apiPage<UserView>(
        `/admin/users?page=${page}&limit=10&search=${encodeURIComponent(query)}`,
      ),
    );
  }, [page, query]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (active) await load();
      } catch (err) {
        if (!active || handleUnauthorized(err, router)) return;
        setToast({ type: 'error', text: apiErrorText(err, 'Gagal memuat user.') });
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
        // Role picker is optional; backend validation remains authoritative.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function reportError(err: unknown) {
    if (handleUnauthorized(err, router)) return;
    setToast({ type: 'error', text: apiErrorText(err) });
  }

  function openCreate() {
    setEditingId(null);
    setFormErrors({});
    setForm({ ...emptyForm });
  }

  function openEdit(user: UserView) {
    setEditingId(user.id);
    setFormErrors({});
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

  async function submit() {
    if (!form) return;
    const found: FieldErrors = {};
    if (!editingId && !form.email.trim()) found.email = 'Email wajib diisi';
    if (!editingId && form.password.length < 6) {
      found.password = 'Password minimal 6 karakter';
    }
    setFormErrors(found);
    if (Object.keys(found).length > 0) return;

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
      reportError(err);
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
      reportError(err);
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
            reportError(err);
          }
        })();
      },
    });
  }

  async function showDetail(user: UserView) {
    try {
      setDetail(await api<UserView>(`/admin/users/${user.id}`));
    } catch (err) {
      reportError(err);
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
    return <EmptyState title="Tidak ada akses" text="Anda tidak memiliki izin read:user." />;
  }

  const isFormOpen = Boolean(form);

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <PageHeader
        title="Users"
        description="Kelola akun, multi-role, dan status aktif."
        action={
          has('create:user') ? (
            <Button onClick={openCreate}>Tambah user</Button>
          ) : undefined
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
            aria-label="Cari email atau username"
            placeholder="Cari email/username"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="secondary">
            Cari
          </Button>
        </form>

        {!data ? (
          <LoadingState rows={5} />
        ) : data.items.length === 0 ? (
          <EmptyState title="Belum ada user" text="Tidak ada user yang cocok." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Access role</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => {
                  const isSelf = user.id === me?.id;
                  return (
                    <tr key={user.id} className="hover:bg-canvas">
                      <Td>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-xs text-text-muted">{user.email}</p>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length === 0 ? (
                            <span className="text-sm text-text-muted">Tanpa role</span>
                          ) : (
                            user.roles.map((role) => (
                              <Badge key={role.id} variant="access">
                                {role.name}
                                {role.isSystem ? ' · sistem' : ''}
                              </Badge>
                            ))
                          )}
                        </div>
                      </Td>
                      <Td>
                        <Badge variant={user.isActive ? 'success' : 'warning'}>
                          {user.isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                        {isSelf && (
                          <p className="mt-1 text-xs text-text-muted">Akun Anda</p>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => void showDetail(user)}
                          >
                            Detail
                          </Button>
                          {has('update:user') && !isSelf && (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => openEdit(user)}
                            >
                              Edit
                            </Button>
                          )}
                          {!isSelf && (has('update:user') || has('delete:user')) && (
                            <details className="relative">
                              <summary className="cursor-pointer list-none rounded-sm px-2 py-1 text-xs font-medium text-brand-primary hover:underline">
                                More
                              </summary>
                              <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-border-subtle bg-surface p-1 shadow-2">
                                {has('update:user') && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.currentTarget.closest('details')!.open = false;
                                      void toggleActive(user);
                                    }}
                                    className="block w-full rounded-sm px-2 py-1.5 text-left text-sm text-text-secondary hover:bg-brand-primary-subtle"
                                  >
                                    {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                  </button>
                                )}
                                {has('delete:user') && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.currentTarget.closest('details')!.open = false;
                                      requestDelete(user);
                                    }}
                                    className="block w-full rounded-sm px-2 py-1.5 text-left text-sm text-danger hover:bg-danger-surface"
                                  >
                                    Hapus
                                  </button>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="mt-4">
              <Pagination page={page} limit={10} total={data.total} onPage={setPage} />
            </div>
          </>
        )}
      </div>

      <Drawer
        open={isFormOpen}
        onClose={() => setForm(null)}
        title={editingId ? 'Edit user' : 'User baru'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Batal
            </Button>
            <Button onClick={() => void submit()} loading={busy}>
              Simpan
            </Button>
          </>
        }
      >
        {form && (
          <form
            id="user-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" htmlFor="user-email" error={formErrors.email} required>
                <Input
                  id="user-email"
                  type="email"
                  value={form.email}
                  disabled={Boolean(editingId)}
                  invalid={Boolean(formErrors.email)}
                  onChange={(event) => {
                    setForm({ ...form, email: event.target.value });
                    setFormErrors((previous) => ({ ...previous, email: undefined }));
                  }}
                />
              </Field>
              <Field label="Username (opsional)" htmlFor="user-username">
                <Input
                  id="user-username"
                  value={form.username}
                  disabled={Boolean(editingId)}
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
                />
              </Field>
              <Field label="Nama" htmlFor="user-name">
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="Telepon" htmlFor="user-phone">
                <Input
                  id="user-phone"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </Field>
              {!editingId && (
                <Field label="Password" htmlFor="user-password" error={formErrors.password} required>
                  <Input
                    id="user-password"
                    type="password"
                    value={form.password}
                    invalid={Boolean(formErrors.password)}
                    onChange={(event) => {
                      setForm({ ...form, password: event.target.value });
                      setFormErrors((previous) => ({ ...previous, password: undefined }));
                    }}
                  />
                </Field>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-text-secondary">Access role</p>
              <div className="grid max-h-52 gap-2 overflow-y-auto rounded-md border border-border-subtle p-3 sm:grid-cols-2">
                {roles.length === 0 ? (
                  <p className="text-sm text-text-muted">Tidak ada role yang dapat dipilih.</p>
                ) : (
                  roles.map((role) => (
                    <Checkbox
                      key={role.id}
                      label={role.name}
                      checked={form.roleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {editingId && (
              <Checkbox
                label="Aktif"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
            )}
          </form>
        )}
      </Drawer>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detail user"
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Tutup
          </Button>
        }
      >
        {detail && (
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-text-muted">Email</dt>
              <dd>{detail.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Username</dt>
              <dd>{detail.username}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Nama</dt>
              <dd>{detail.name ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Telepon</dt>
              <dd>{detail.phone ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Status</dt>
              <dd>
                <Badge variant={detail.isActive ? 'success' : 'warning'}>
                  {detail.isActive ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Access role</dt>
              <dd className="flex flex-wrap gap-1">
                {detail.roles.map((role) => (
                  <Badge key={role.id} variant="access">{role.name}</Badge>
                ))}
              </dd>
            </div>
          </dl>
        )}
      </Drawer>
    </div>
  );
}
