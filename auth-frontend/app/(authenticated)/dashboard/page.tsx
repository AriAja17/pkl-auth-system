'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiPage } from '@/lib/api';
import type { AuditLogView, Page } from '@/lib/api-types';
import { useAuth } from '@/lib/auth-context';
import { apiErrorText, handleUnauthorized } from '@/lib/errors';
import { hasVisibleAccessRoute } from '@/lib/navigation';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import PageHeader from '@/components/page-header';
import ActivityDetail from '@/components/activity-detail';

export default function DashboardPage() {
  const { me, has } = useAuth();
  const router = useRouter();
  const [activity, setActivity] = useState<Page<AuditLogView> | null>(null);
  const [activityError, setActivityError] = useState('');
  const [selected, setSelected] = useState<AuditLogView | null>(null);

  const canViewActivity = has('read:audit');
  const canManageAccess = hasVisibleAccessRoute(has);

  const loadActivity = useCallback(async () => {
    const result = await apiPage<AuditLogView>('/admin/audit-logs?page=1&limit=5');
    return result;
  }, []);

  useEffect(() => {
    if (!canViewActivity) return;
    let active = true;
    void (async () => {
      try {
        const result = await loadActivity();
        if (active) {
          setActivity(result);
          setActivityError('');
        }
      } catch (err) {
        if (!active || handleUnauthorized(err, router)) return;
        setActivityError(apiErrorText(err, 'Gagal memuat aktivitas.'));
      }
    })();
    return () => {
      active = false;
    };
  }, [canViewActivity, loadActivity, router]);

  if (!me) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Selamat datang, ${me.username}`}
        description="Workspace · ringkasan identitas dan aktivitas terbaru."
      />

      <Card title="Identitas akun">
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-text-muted">Email</p>
            <p className="text-sm text-text-primary">{me.email}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Access role</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {me.roles.length === 0 ? (
                <span className="text-sm text-text-muted">
                  Belum ada role. Menunggu admin memberi akses.
                </span>
              ) : (
                me.roles.map((role) => (
                  <Badge key={role.id} variant="access">
                    {role.name}
                    {role.isSystem ? ' · sistem' : ''}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>

      {canViewActivity && (
        <Card title="Recent Activity" description="Aktivitas administratif terbaru.">
          <div className="mt-4">
            {activityError ? (
              <ErrorState message={activityError} />
            ) : !activity ? (
              <LoadingState label="Memuat aktivitas..." rows={4} />
            ) : activity.items.length === 0 ? (
              <EmptyState title="Belum ada aktivitas" text="Belum ada aksi yang tercatat." />
            ) : (
              <ul className="divide-y divide-divider rounded-md border border-border-subtle">
                {activity.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary">
                        <span className="font-medium">{item.actorEmail}</span>{' '}
                        <span className="font-mono text-xs text-text-secondary">
                          {item.action}
                        </span>
                      </p>
                      <p className="text-xs text-text-muted">
                        {new Date(item.createdAt).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <Button variant="link" size="sm" onClick={() => setSelected(item)}>
                      Lihat
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      {(canManageAccess || canViewActivity) && (
        <Card title="Quick actions">
          <div className="mt-3 flex flex-wrap gap-2">
            {canManageAccess && (
              <Link href="/admin">
                <Button variant="primary">Kelola akses</Button>
              </Link>
            )}
            {canViewActivity && (
              <Link href="/admin/audit-logs">
                <Button variant="secondary">Lihat aktivitas</Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* My Projects is intentionally not rendered (Phase 04 §5.1 / Phase 05 §5.3). */}

      <ActivityDetail log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
