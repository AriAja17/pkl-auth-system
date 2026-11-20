'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiPage } from '@/lib/api';
import type { DelegationView, Page, PermissionView, UserView } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import { delegablePermissions } from '@/lib/delegation';
import { apiErrorText, handleUnauthorized } from '@/lib/errors';
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  Input,
  LoadingState,
  Pagination,
  Select,
  Table,
  Td,
  Th,
  Toast,
  type ToastState,
} from '@/components/ui';
import PageHeader from '@/components/page-header';
import PermissionPicker, { type CatalogState } from '@/components/permission-picker';

type FormState = { granteeId: string; permissionKeys: string[]; expiresAt: string };

const emptyForm: FormState = { granteeId: '', permissionKeys: [], expiresAt: '' };
const MAX_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function DelegationsPage() {
  const { has, me } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [granteeFilter, setGranteeFilter] = useState('');
  const [data, setData] = useState<Page<DelegationView> | null>(null);
  const [users, setUsers] = useState<UserView[]>([]);
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
  const [formError, setFormError] = useState('');
  const [detail, setDetail] = useState<DelegationView | null>(null);
  const [revokedIds, setRevokedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const userNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) map.set(user.id, user.username ?? user.email);
    return map;
  }, [users]);

  const expiryBounds = useMemo(() => {
    const now = new Date();
    return {
      min: toLocalInput(new Date(now.getTime() + 60_000)),
      max: toLocalInput(new Date(now.getTime() + MAX_TTL_MS)),
    };
  }, []);

  const eligible = useMemo(
    () => delegablePermissions(permissions, me),
    [permissions, me],
  );

  const load = useCallback(async () => {
    const suffix = granteeFilter ? `&granteeId=${granteeFilter}` : '';
    setData(
      await apiPage<DelegationView>(
        `/admin/delegations?page=${page}&limit=10${suffix}`,
      ),
    );
  }, [page, granteeFilter]);

  const loadCatalog = useCallback(async () => {
    try {
      const [userPage, permissionPage] = await Promise.all([
        apiPage<UserView>('/admin/users?page=1&limit=100'),
        apiPage<PermissionView>('/admin/permissions?page=1&limit=100'),
      ]);
      setUsers(userPage.items.filter((user) => user.id !== me?.id));
      setPermissions(permissionPage.items);
      setCatalogState(permissionPage.items.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      if (handleUnauthorized(err, router)) return;
      setPermissions([]);
      setCatalogState('error');
    }
  }, [me?.id, router]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (active) await load();
      } catch (err) {
        if (!active || handleUnauthorized(err, router)) return;
        setToast({ type: 'error', text: apiErrorText(err, 'Gagal memuat delegasi.') });
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

  function reportError(err: unknown) {
    if (handleUnauthorized(err, router)) return;
    setToast({ type: 'error', text: apiErrorText(err) });
  }

  function openCreate() {
    setFormError('');
    setForm({ ...emptyForm });
  }

  async function submit() {
    if (!form || catalogState !== 'ready') return;
    const expires = new Date(form.expiresAt);
    if (!form.granteeId || form.permissionKeys.length === 0 || Number.isNaN(expires.getTime())) {
      setFormError('Grantee, permission, dan waktu kedaluwarsa wajib diisi.');
      return;
    }
    if (expires.getTime() <= Date.now()) {
      setFormError('Waktu kedaluwarsa harus di masa depan.');
      return;
    }
    if (expires.getTime() > Date.now() + MAX_TTL_MS) {
      setFormError('Maksimal masa delegasi 90 hari.');
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
      reportError(err);
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
            reportError(err);
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
    return <EmptyState title="Tidak ada akses" text="Anda tidak memiliki izin read:delegation." />;
  }

  const saveDisabled = busy || catalogState !== 'ready';

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      <PageHeader
        title="Delegation"
        description="AdminCapability, batasan capability, dan validasi lineage."
        action={
          has('create:delegation') ? (
            <Button onClick={openCreate}>Buat delegasi</Button>
          ) : undefined
        }
      />

      {revokedIds.length > 0 && (
        <div role="status" className="rounded-md border border-info bg-info-surface p-3 text-sm text-info">
          Descendant yang ikut dicabut:{' '}
          <span className="font-mono">{revokedIds.join(', ')}</span>
          <Button variant="link" size="sm" className="ml-2" onClick={() => setRevokedIds([])}>
            Tutup
          </Button>
        </div>
      )}

      <div className="rounded-md border border-border-subtle bg-surface p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
          className="mb-4 flex flex-wrap gap-2"
        >
          <Select
            aria-label="Filter grantee"
            value={granteeFilter}
            onChange={(event) => setGranteeFilter(event.target.value)}
            className="max-w-xs"
          >
            <option value="">Semua grantee</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>

        {!data ? (
          <LoadingState rows={5} />
        ) : data.items.length === 0 ? (
          <EmptyState title="Belum ada delegasi" text="Tidak ada delegasi yang cocok." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Grantee</Th>
                  <Th>Permission</Th>
                  <Th>Grantor</Th>
                  <Th>Expired</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-canvas">
                    <Td>{userNames.get(item.granteeId) ?? <span className="font-mono text-xs">{item.granteeId}</span>}</Td>
                    <Td className="font-mono text-xs">{item.permissionKey}</Td>
                    <Td>{userNames.get(item.grantedBy) ?? <span className="font-mono text-xs">{item.grantedBy}</span>}</Td>
                    <Td className="text-xs text-text-muted">
                      {new Date(item.expiresAt).toLocaleString('id-ID')}
                    </Td>
                    <Td>
                      <Badge variant={item.valid ? 'success' : 'danger'}>
                        {item.valid ? 'valid' : 'tidak valid'}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="link" size="sm" onClick={() => setDetail(item)}>
                          Detail
                        </Button>
                        {has('delete:delegation') && (
                          <Button
                            variant="link"
                            size="sm"
                            className="text-danger"
                            onClick={() => requestRevoke(item)}
                          >
                            Cabut
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
        title="Delegasi baru"
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
              <Field label="Grantee" htmlFor="delegation-grantee" required>
                <Select
                  id="delegation-grantee"
                  value={form.granteeId}
                  onChange={(event) => setForm({ ...form, granteeId: event.target.value })}
                >
                  <option value="">Pilih grantee</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} — {user.email}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Kedaluwarsa"
                htmlFor="delegation-expiry"
                hint="Maksimal 90 hari. Parent capability ditentukan server."
                required
              >
                <Input
                  id="delegation-expiry"
                  type="datetime-local"
                  min={expiryBounds.min}
                  max={expiryBounds.max}
                  value={form.expiresAt}
                  onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
                />
              </Field>
            </div>

            {formError && (
              <p role="alert" className="text-sm text-danger">{formError}</p>
            )}

            <PermissionPicker
              permissions={eligible}
              selectedKeys={form.permissionKeys}
              onToggle={togglePermission}
              state={catalogState}
              onRetry={() => {
                setCatalogState('loading');
                void loadCatalog();
              }}
              hint="Hanya permission yang memenuhi aturan backend yang ditampilkan. Backend tetap memvalidasi."
            />
          </div>
        )}
      </Drawer>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detail delegasi"
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>Tutup</Button>
        }
      >
        {detail && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-text-muted">Grantee</dt>
              <dd>{userNames.get(detail.granteeId) ?? <span className="font-mono text-xs">{detail.granteeId}</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Grantor</dt>
              <dd>{userNames.get(detail.grantedBy) ?? <span className="font-mono text-xs">{detail.grantedBy}</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Permission</dt>
              <dd className="font-mono">{detail.permissionKey}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Parent capability</dt>
              <dd className="font-mono text-xs">{detail.parentCapabilityId ?? 'root'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Diberikan</dt>
              <dd>{new Date(detail.grantedAt).toLocaleString('id-ID')}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Kedaluwarsa</dt>
              <dd>{new Date(detail.expiresAt).toLocaleString('id-ID')}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Status</dt>
              <dd>
                <Badge variant={detail.valid ? 'success' : 'danger'}>
                  {detail.valid ? 'valid' : 'tidak valid'}
                </Badge>
              </dd>
            </div>
          </dl>
        )}
      </Drawer>
    </div>
  );
}
