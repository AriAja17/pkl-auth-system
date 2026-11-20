'use client';

import Link from 'next/link';
import { cx } from '@/lib/cx';
import {
  isActivePath,
  type NavGroupWithItems,
  type NavItem,
} from '@/lib/navigation';

function Icon({ name }: { name: string | null }) {
  const paths: Record<string, string> = {
    dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
    file: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 13h6M9 17h6',
    shield: 'M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z',
    users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19m12 0h3v-1.5a3.5 3.5 0 0 0-2.5-3.36M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    key: 'M14 7a4 4 0 1 1-3.16 6.45L4 20l-1-1 6.55-6.84A4 4 0 0 1 14 7Zm0 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    menu: 'M4 6h16M4 12h16M4 18h16',
    share: 'M9 7 5 11l4 4M5 11h8a6 6 0 0 1 6 6',
    history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l4 2',
  };
  const d = (name && paths[name]) || paths.menu;

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function NavNode({
  item,
  pathname,
  depth,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  depth: number;
  onNavigate: () => void;
}) {
  const hasChildren = item.children.length > 0;

  if (!item.href) {
    return (
      <div>
        <p
          className={cx(
            'px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-text-muted',
            depth > 0 && 'border-l border-border-subtle pl-3',
          )}
        >
          {item.label}
        </p>
        <div className={depth > 0 ? 'ml-3 border-l border-border-subtle pl-2' : ''}>
          {item.children.map((child) => (
            <NavNode
              key={child.key}
              item={child}
              pathname={pathname}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    );
  }

  const active = isActivePath(pathname, item.href);
  return (
    <div>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'flex items-center gap-2 rounded-sm px-3 py-2 text-sm',
          active
            ? 'bg-brand-primary-subtle font-semibold text-brand-primary'
            : 'text-text-secondary hover:bg-brand-primary-subtle hover:text-text-primary',
        )}
      >
        <Icon name={item.icon} />
        <span className="truncate">{item.label}</span>
      </Link>
      {hasChildren && (
        <div className="ml-5 border-l border-border-subtle pl-2">
          {item.children.map((child) => (
            <NavNode
              key={child.key}
              item={child}
              pathname={pathname}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  groups,
  pathname,
  onNavigate,
}: {
  groups: NavGroupWithItems[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="flex h-full flex-col gap-3 overflow-y-auto border-r border-border-subtle bg-surface p-3"
    >
      {groups.map((group) => (
        <div key={group.id}>
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavNode
                key={item.key}
                item={item}
                pathname={pathname}
                depth={0}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
