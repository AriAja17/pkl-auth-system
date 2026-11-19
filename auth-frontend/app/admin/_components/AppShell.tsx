'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, error, has, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !me && !error) router.replace('/login');
  }, [loading, me, error, router]);

  if (loading) return <p className="p-6 text-gray-500">Memuat...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!me) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded border border-gray-300 px-3 py-1 text-sm md:hidden"
          aria-label="Buka navigasi"
        >
          Menu
        </button>
        <span className="text-sm font-semibold">Panel Administrasi</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-gray-500 sm:inline">{me.email}</span>
          <button onClick={logout} className="text-red-600 underline">
            Logout
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-57px)]">
        {open && (
          <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} />
        )}
        <aside
          className={`${
            open ? 'fixed inset-y-0 left-0 z-40 w-64' : 'hidden'
          } md:static md:z-auto md:block md:w-64 md:shrink-0`}
        >
          <Sidebar
            menus={me.menus ?? []}
            pathname={pathname}
            has={has}
            onNavigate={() => setOpen(false)}
          />
        </aside>
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
