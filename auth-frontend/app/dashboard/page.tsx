'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, clearToken, getToken } from '@/lib/api';

type Me = {
  id: string;
  email: string;
  role: string | null;
  permissions: string[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    api<Me>('/auth/me')
      .then(setMe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace('/login');
        } else {
          setError(err.message);
        }
      });
  }, [router]);

  function logout() {
    clearToken();
    router.replace('/login');
  }

  if (error) {
    return <p className="p-6 text-red-600">{error}</p>;
  }
  if (!me) {
    return <p className="p-6 text-gray-500">Memuat...</p>;
  }

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
          {me.role ? (
            <p>{me.role}</p>
          ) : (
            <p className="text-amber-600">
              Belum ada role. Menunggu admin memberi akses.
            </p>
          )}
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-1">Permission</p>
          {me.permissions.length === 0 ? (
            <p className="text-gray-400">Tidak ada</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {me.permissions.map((p) => (
                <span
                  key={p}
                  className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {me.permissions.includes('user.manage') && (
          <Link href="/admin" className="inline-block text-blue-600 underline">
            Buka halaman admin
          </Link>
        )}

        {me.permissions.includes('article.read') && (
        <Link href="/articles" className="inline-block text-blue-600 underline">
          Buka halaman artikel
        </Link>
      )}
      </div>
    </main>
  );
}