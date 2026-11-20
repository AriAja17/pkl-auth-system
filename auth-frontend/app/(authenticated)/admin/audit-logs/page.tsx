'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPage, ApiError, clearToken } from '@/lib/api';
import type { AuditLogView, Page } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import {
  EmptyState,
  LoadingState,
  Pagination,
  Toast,
  type ToastState,
} from '../_components/ui';

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
const SENSITIVE = /password|token|secret|authorization|credential|apikey/i;

function safeJson(value: unknown): string {
  const clean = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(clean);
    if (input !== null && typeof input === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(input as Record<string, unknown>)) {
        if (SENSITIVE.test(key)) continue;
        result[key] = clean(nested);
      }
      return result;
    }
    return input;
  };
  return JSON.stringify(clean(value), null, 2);
}

export default function AuditLogsPage() {
  const { has } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [data, setData] = useState<Page<AuditLogView> | null>(null);
  const [detail, setDetail] = useState<AuditLogView | null>(null);
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
        if (active) {
          if (err instanceof ApiError && err.status === 401) {
            clearToken();
            router.replace('/login');
          } else if (err instanceof ApiError && err.status === 403) {
            setToast({ type: 'error', text: 'Anda tidak punya izin read:audit' });
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

  if (!has('read:audit')) {
    return <p className="p-6 text-red-600">Anda tidak memiliki akses read:audit.</p>;
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-gray-500">
          Riwayat aksi administratif. `action` memakai format `resource.action`.
        </p>
      </div>

      {detail && (
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Detail audit log</h2>
            <button onClick={() => setDetail(null)} className="text-sm text-gray-500 underline">
              Tutup
            </button>
          </div>
          <p className="mt-2 text-sm">Aksi: {detail.action}</p>
          <p className="text-sm">Resource: {detail.resourceType} {detail.resourceId ?? ''}</p>
          <p className="text-sm">Actor: {detail.actorEmail}</p>
          <p className="text-sm">Waktu: {new Date(detail.createdAt).toLocaleString('id-ID')}</p>
          {detail.summary && <p className="text-sm">Ringkasan: {detail.summary}</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs">
              before: {safeJson(detail.before)}
            </pre>
            <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs">
              after: {safeJson(detail.after)}
            </pre>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white p-4 shadow">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setFilters(draft);
          }}
          className="mb-3 grid gap-2 sm:grid-cols-3"
        >
          <input
            placeholder="Action (user.create)"
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
            className="rounded border border-gray-300 p-2 text-sm"
          />
          <input
            placeholder="Resource type"
            value={draft.resourceType}
            onChange={(e) => setDraft({ ...draft, resourceType: e.target.value })}
            className="rounded border border-gray-300 p-2 text-sm"
          />
          <input
            placeholder="Actor ID"
            value={draft.actorId}
            onChange={(e) => setDraft({ ...draft, actorId: e.target.value })}
            className="rounded border border-gray-300 p-2 text-sm"
          />
          <input
            placeholder="Resource ID"
            value={draft.resourceId}
            onChange={(e) => setDraft({ ...draft, resourceId: e.target.value })}
            className="rounded border border-gray-300 p-2 text-sm"
          />
          <input
            type="datetime-local"
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            className="rounded border border-gray-300 p-2 text-sm"
          />
          <input
            type="datetime-local"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            className="rounded border border-gray-300 p-2 text-sm"
          />
          <div className="flex gap-2">
            <button className="rounded bg-gray-800 px-3 py-2 text-sm text-white">Filter</button>
            <button
              type="button"
              onClick={() => {
                const reset = emptyFilters;
                setDraft(reset);
                setFilters(reset);
                setPage(1);
              }}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              Reset
            </button>
          </div>
        </form>

        {!data ? (
          <LoadingState />
        ) : data.items.length === 0 ? (
          <EmptyState text="Tidak ada audit log yang cocok." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2">Waktu</th>
                    <th className="py-2">Aksi</th>
                    <th className="py-2">Resource</th>
                    <th className="py-2">Actor</th>
                    <th className="py-2 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2">{new Date(item.createdAt).toLocaleString('id-ID')}</td>
                      <td className="py-2 font-medium">{item.action}</td>
                      <td className="py-2">{item.resourceType}</td>
                      <td className="py-2">{item.actorEmail}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => setDetail(item)}
                          className="text-blue-600 underline"
                        >
                          Lihat
                        </button>
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
