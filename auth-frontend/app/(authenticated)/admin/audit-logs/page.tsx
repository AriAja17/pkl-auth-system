'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPage } from '@/lib/api';
import type { AuditLogView, Page } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import { apiErrorText, handleUnauthorized } from '@/lib/errors';
import {
  Badge,
  Button,
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
import ActivityDetail from '@/components/activity-detail';

type Filters = {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  from: string;
  to: string;
};

const emptyFilters: Filters = {
  actorId: '',
  action: '',
  resourceType: '',
  resourceId: '',
  from: '',
  to: '',
};

export default function AuditLogsPage() {
  const { has } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [data, setData] = useState<Page<AuditLogView> | null>(null);
  const [selected, setSelected] = useState<AuditLogView | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '10' });
    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;
      if ((key === 'from' || key === 'to') && !Number.isNaN(new Date(value).getTime())) {
        params.set(key, new Date(value).toISOString());
      } else {
        params.set(key, value);
      }
    }
    setData(await apiPage<AuditLogView>(`/admin/audit-logs?${params.toString()}`));
  }, [page, filters]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (active) await load();
      } catch (err) {
        if (!active || handleUnauthorized(err, router)) return;
        setToast({
          type: 'error',
          text: apiErrorText(err, 'Gagal memuat activity / audit.'),
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [load, router]);

  if (!has('read:audit')) {
    return <EmptyState title="Tidak ada akses" text="Anda tidak memiliki izin read:audit." />;
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <PageHeader
        title="Activity / Audit"
        description={
          <>
            Riwayat aksi administratif. <code className="font-mono text-xs">action: resource.action</code>
          </>
        }
      />

      <div className="rounded-md border border-border-subtle bg-surface p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setFilters(draft);
          }}
          className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Action" htmlFor="filter-action">
            <Input
              id="filter-action"
              placeholder="user.create"
              value={draft.action}
              className="font-mono"
              onChange={(event) => setDraft({ ...draft, action: event.target.value })}
            />
          </Field>
          <Field label="Resource type" htmlFor="filter-resource-type">
            <Input
              id="filter-resource-type"
              placeholder="role"
              value={draft.resourceType}
              onChange={(event) => setDraft({ ...draft, resourceType: event.target.value })}
            />
          </Field>
          <Field label="Actor ID" htmlFor="filter-actor">
            <Input
              id="filter-actor"
              value={draft.actorId}
              className="font-mono"
              onChange={(event) => setDraft({ ...draft, actorId: event.target.value })}
            />
          </Field>
          <Field label="Resource ID" htmlFor="filter-resource-id">
            <Input
              id="filter-resource-id"
              value={draft.resourceId}
              className="font-mono"
              onChange={(event) => setDraft({ ...draft, resourceId: event.target.value })}
            />
          </Field>
          <Field label="Dari" htmlFor="filter-from">
            <Input
              id="filter-from"
              type="datetime-local"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            />
          </Field>
          <Field label="Sampai" htmlFor="filter-to">
            <Input
              id="filter-to"
              type="datetime-local"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit">Filter</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft(emptyFilters);
                setFilters(emptyFilters);
                setPage(1);
              }}
            >
              Reset
            </Button>
          </div>
        </form>

        {!data ? (
          <LoadingState rows={5} />
        ) : data.items.length === 0 ? (
          <EmptyState
            title="Tidak ada audit log yang cocok"
            text="Ubah filter lalu coba lagi."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Waktu</Th>
                  <Th>Aksi</Th>
                  <Th>Resource</Th>
                  <Th>Actor</Th>
                  <Th className="text-right">Detail</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-canvas">
                    <Td className="whitespace-nowrap text-xs text-text-muted">
                      {new Date(item.createdAt).toLocaleString('id-ID')}
                    </Td>
                    <Td className="font-mono text-xs">{item.action}</Td>
                    <Td>
                      <Badge variant="info">{item.resourceType}</Badge>
                      {item.resourceId && (
                        <span className="ml-1 font-mono text-xs text-text-muted">
                          {item.resourceId}
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs">{item.actorEmail}</Td>
                    <Td>
                      <div className="flex justify-end">
                        <Button variant="link" size="sm" onClick={() => setSelected(item)}>
                          Lihat
                        </Button>
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

      {/* The drawer is mounted beside the table; filters and page stay intact. */}
      <ActivityDetail log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
