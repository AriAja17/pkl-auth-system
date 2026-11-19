'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const SECTIONS = [
  { label: 'User', href: '/admin/users', permission: 'read:user', note: 'Kelola akun, multi-role, dan status aktif.' },
  { label: 'Role', href: '/admin/roles', permission: 'read:role', note: 'Kelola role dan assignment permission.' },
  { label: 'Permission', href: '/admin/permissions', permission: 'read:permission', note: 'Katalog permission dan drift policy.' },
  { label: 'Menu', href: '/admin/menus', permission: 'read:menu', note: 'Struktur menu dan permission mapping.' },
  { label: 'Delegasi', href: '/admin/delegations', permission: 'read:delegation', note: 'Capability delegasi dan lineage.' },
  { label: 'Audit Log', href: '/admin/audit-logs', permission: 'read:audit', note: 'Riwayat aksi administratif.' },
] as const;

export default function AdminHomePage() {
  const { me, has } = useAuth();
  const accessible = SECTIONS.filter((section) => has(section.permission));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Panel Administrasi</h1>
        <p className="text-sm text-gray-500">
          {me ? `Masuk sebagai ${me.username}. ` : ''}
          Pilih bagian yang bisa Anda akses.
        </p>
      </div>

      {accessible.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow">
          Belum ada bagian administrasi yang tersedia untuk akun ini.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accessible.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-xl bg-white p-4 shadow transition hover:shadow-md"
            >
              <h2 className="font-semibold text-blue-700">{section.label}</h2>
              <p className="mt-1 text-sm text-gray-500">{section.note}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
