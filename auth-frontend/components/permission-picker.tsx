'use client';

import { useMemo } from 'react';
import type { PermissionView } from '@/lib/api-types';
import { Badge, Checkbox, EmptyState, ErrorState, LoadingState } from '@/components/ui';

export type CatalogState = 'loading' | 'ready' | 'empty' | 'error';

export default function PermissionPicker({
  permissions,
  selectedKeys,
  onToggle,
  state,
  disabled = false,
  lockedKeys,
  onRetry,
  hint,
}: {
  permissions: PermissionView[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  state: CatalogState;
  disabled?: boolean;
  /** Keys rendered but not selectable (e.g. protected keys for non-system actors). */
  lockedKeys?: string[];
  onRetry?: () => void;
  hint?: string;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, PermissionView[]>();
    for (const permission of permissions) {
      const resource = permission.key.includes(':')
        ? permission.key.slice(permission.key.indexOf(':') + 1)
        : 'lainnya';
      const list = map.get(resource) ?? [];
      list.push(permission);
      map.set(resource, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const locked = new Set(lockedKeys ?? []);

  if (state === 'loading') {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold text-text-secondary">
          Permission (action:resource)
        </p>
        <LoadingState label="Memuat katalog permission..." rows={3} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <ErrorState
        title="Katalog permission gagal dimuat"
        message="Simpan dinonaktifkan sampai katalog tersedia."
        onRetry={onRetry}
      />
    );
  }

  if (state === 'empty') {
    return (
      <EmptyState
        title="Katalog permission kosong"
        text="Tidak ada permission yang dapat dipilih."
      />
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-text-secondary">
          Permission (action:resource)
        </p>
        <span className="text-xs text-text-muted">
          {selectedKeys.length} dipilih
        </span>
      </div>
      {hint && <p className="mb-2 text-xs text-text-muted">{hint}</p>}
      <div className="max-h-56 space-y-3 overflow-y-auto rounded-md border border-border-subtle p-3">
        {grouped.map(([resource, items]) => (
          <div key={resource}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {resource}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((permission) => {
                const isLocked = disabled || locked.has(permission.key);
                return (
                  <Checkbox
                    key={permission.id}
                    label={
                      <span className="font-mono text-xs">{permission.key}</span>
                    }
                    checked={selectedKeys.includes(permission.key)}
                    disabled={isLocked}
                    onChange={() => {
                      if (!isLocked) onToggle(permission.key);
                    }}
                    hint={
                      permission.isProtected
                        ? 'Protected — hanya untuk actor sistem'
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {permissions.some((permission) => permission.isProtected) && (
        <div className="mt-2">
          <Badge variant="warning">protected</Badge>
        </div>
      )}
    </div>
  );
}
