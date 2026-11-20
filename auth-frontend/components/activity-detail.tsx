'use client';

import type { AuditLogView } from '@/lib/api-types';
import { safeJson } from '@/lib/audit';
import { Badge, Drawer } from '@/components/ui';

/** Shared by Overview "Recent Activity" and the Activity / Audit page. */
export default function ActivityDetail({
  log,
  onClose,
}: {
  log: AuditLogView | null;
  onClose: () => void;
}) {
  return (
    <Drawer open={Boolean(log)} onClose={onClose} title="Detail aktivitas">
      {log && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-text-muted">Aksi</p>
              <p className="font-mono text-xs text-text-primary">{log.action}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Waktu</p>
              <p className="text-sm text-text-primary">
                {new Date(log.createdAt).toLocaleString('id-ID')}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Resource</p>
              <p className="text-sm text-text-primary">
                <span className="font-mono">{log.resourceType}</span>
                {log.resourceId ? (
                  <span className="ml-1 font-mono text-text-muted">
                    / {log.resourceId}
                  </span>
                ) : null}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Actor</p>
              <p className="text-sm text-text-primary">{log.actorEmail}</p>
            </div>
          </div>

          {log.summary && (
            <p className="text-sm text-text-secondary">{log.summary}</p>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-text-secondary">Before</p>
              <pre className="overflow-x-auto rounded-sm bg-surface-subtle p-3 font-mono text-xs text-text-primary">
                {safeJson(log.before)}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-text-secondary">After</p>
              <pre className="overflow-x-auto rounded-sm bg-surface-subtle p-3 font-mono text-xs text-text-primary">
                {safeJson(log.after)}
              </pre>
            </div>
          </div>

          <Badge variant="info">Data sudah diredaksi oleh backend</Badge>
        </div>
      )}
    </Drawer>
  );
}
