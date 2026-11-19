'use client';

import Link from 'next/link';
import type { MenuNode } from '@/lib/api-types';

const SECTIONS = [
  { label: 'User', href: '/admin/users', permission: 'read:user' },
  { label: 'Role', href: '/admin/roles', permission: 'read:role' },
  { label: 'Permission', href: '/admin/permissions', permission: 'read:permission' },
  { label: 'Menu', href: '/admin/menus', permission: 'read:menu' },
  { label: 'Delegasi', href: '/admin/delegations', permission: 'read:delegation' },
  { label: 'Audit Log', href: '/admin/audit-logs', permission: 'read:audit' },
] as const;

type Props = {
  menus: MenuNode[];
  pathname: string;
  has: (permission: string) => boolean;
  onNavigate?: () => void;
};

function linkClass(href: string, pathname: string) {
  return `block rounded px-3 py-2 text-sm ${
    pathname === href || pathname.startsWith(`${href}/`)
      ? 'bg-blue-50 font-medium text-blue-700'
      : 'text-gray-700 hover:bg-gray-100'
  }`;
}

function MenuBranch({
  node,
  pathname,
  onNavigate,
}: {
  node: MenuNode;
  pathname: string;
  onNavigate?: () => void;
}) {
  if (node.url) {
    return (
      <Link href={node.url} className={linkClass(node.url, pathname)} onClick={onNavigate}>
        {node.name}
      </Link>
    );
  }
  return (
    <div className="space-y-1">
      <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {node.name}
      </p>
      {node.children.map((child) => (
        <MenuBranch
          key={child.id}
          node={child}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

export default function Sidebar({ menus, pathname, has, onNavigate }: Props) {
  const hasMenuLinks = menus.some(
    (menu) => Boolean(menu.url) || menu.children.length > 0,
  );

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto border-r border-gray-200 bg-white p-3">
      <Link href="/dashboard" className={linkClass('/dashboard', pathname)} onClick={onNavigate}>
        Dashboard
      </Link>
      {has('read:article') && (
        <Link href="/articles" className={linkClass('/articles', pathname)} onClick={onNavigate}>
          Artikel
        </Link>
      )}

      <p className="px-3 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Administrasi
      </p>
      <Link href="/admin" className={linkClass('/admin', pathname)} onClick={onNavigate}>
        Ringkasan
      </Link>

      {hasMenuLinks ? (
        menus.map((menu) => (
          <MenuBranch
            key={menu.id}
            node={menu}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))
      ) : (
        <>
          {SECTIONS.filter((section) => has(section.permission)).map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={linkClass(section.href, pathname)}
              onClick={onNavigate}
            >
              {section.label}
            </Link>
          ))}
          {!has('read:menu') && (
            <p className="px-3 py-2 text-xs text-gray-400">
              Menu belum dikonfigurasi.
            </p>
          )}
        </>
      )}
    </nav>
  );
}
