'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const ADMIN_KEYS = [
  'read:user',
  'read:role',
  'read:permission',
  'read:menu',
  'read:delegation',
  'read:audit',
  'manage:user',
];

export default function DashboardPage() {
  const { me, loading, error, has, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me && !error) router.replace('/login');
  }, [loading, me, error, router]);

  if (loading) return <p className="p-6 text-gray-500">Memuat...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!me) return null;

  const roleNames = me.roles?.map((role) => role.name).join(', ');
  const permissions = me.canonicalPermissions ?? [];
  const canAdmin = ADMIN_KEYS.some((key) => has(key));

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow text-gray-900 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button onClick={logout} className="text-sm text-red-600 underline">
            Logout
          </button>
        </div>

        <div>
          <p className="text-sm text-gray-500">Email</p>
          <p>{me.email}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Role</p>
          {roleNames ? (
            <p>{roleNames}</p>
          ) : (
            <p className="text-amber-600">
              Belum ada role. Menunggu admin memberi akses.
            </p>
          )}
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-1">Permission</p>
          {permissions.length === 0 ? (
            <p className="text-gray-400">Tidak ada</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {permissions.map((key) => (
                <span
                  key={key}
                  className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700"
                >
                  {key}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          {canAdmin && (
            <Link href="/admin" className="text-blue-600 underline">
              Buka panel administrasi
            </Link>
          )}
          {has('read:article') && (
            <Link href="/articles" className="text-blue-600 underline">
              Buka halaman artikel
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
