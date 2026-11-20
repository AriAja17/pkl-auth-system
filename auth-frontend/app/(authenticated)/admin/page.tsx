'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { visibleNavRoutes } from '@/lib/navigation';

export default function AdminHomePage() {
  const { me, has } = useAuth();
  const accessible = visibleNavRoutes(has).filter(
    (route) => route.group === 'access-activity' && route.path !== '/admin',
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Panel Administrasi
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {me ? `Masuk sebagai ${me.username}. ` : ''}
          Pilih bagian yang bisa Anda akses.
        </p>
      </div>

      {accessible.length === 0 ? (
        <p className="rounded-md border border-border-subtle bg-surface p-4 text-sm text-text-muted">
          Belum ada bagian administrasi yang tersedia untuk akun ini.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accessible.map((route) => (
            <Link
              key={route.path}
              href={route.path}
              className="rounded-md border border-border-subtle bg-surface p-4 transition-colors hover:border-brand-primary hover:bg-brand-primary-subtle"
            >
              <h2 className="font-semibold text-brand-primary">{route.label}</h2>
              {route.description && (
                <p className="mt-1 text-sm text-text-muted">{route.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
