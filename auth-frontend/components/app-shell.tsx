'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { buildNavigation } from '@/lib/navigation';
import Topbar from './topbar';
import Sidebar from './sidebar';
import Breadcrumb from './breadcrumb';
import { ErrorState, LoadingState } from './ui';

/**
 * The single authenticated shell. Page contents are deliberately untouched —
 * Batch 02 migrates individual pages to the shared primitives.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, error, has, logout, refresh } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  // Navigation state is keyed by pathname so it resets on navigation without
  // an effect that calls setState synchronously.
  const [navState, setNavState] = useState({ path: pathname, open: false });
  const open = navState.path === pathname && navState.open;
  const closeSidebar = useCallback(
    () => setNavState({ path: pathname, open: false }),
    [pathname],
  );
  const toggleSidebar = () =>
    setNavState((previous) => ({
      path: pathname,
      open: !(previous.path === pathname && previous.open),
    }));
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!loading && !me && !error) router.replace('/login');
  }, [loading, me, error, router]);

  useEffect(() => {
    if (!open) return;
    sidebarRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeSidebar]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[var(--layout-content-max)]">
        <LoadingState label="Memuat sesi..." />
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="mx-auto w-full max-w-lg p-6">
        <ErrorState
          message={error ?? 'Sesi tidak ditemukan. Silakan masuk kembali.'}
          onRetry={() => void refresh()}
        />
      </div>
    );
  }

  const groups = buildNavigation(me.menus ?? [], has);

  const sidebar = (
    <Sidebar
      groups={groups}
      pathname={pathname}
      onNavigate={closeSidebar}
    />
  );

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <Topbar
        email={me.email}
        roles={me.roles ?? []}
        onLogout={logout}
        onToggleSidebar={toggleSidebar}
        sidebarOpen={open}
        menuButtonRef={menuButtonRef}
      />

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-56px)] w-[var(--layout-sidebar)] shrink-0 md:block">
          {sidebar}
        </aside>

        {open && (
          <>
            <div
              aria-hidden="true"
              onClick={closeSidebar}
              className="fixed inset-x-0 bottom-0 top-14 z-30 bg-overlay md:hidden"
            />
            <aside
              ref={sidebarRef}
              tabIndex={-1}
              className="fixed bottom-0 left-0 top-14 z-40 w-[var(--layout-sidebar-mobile)] outline-none md:hidden"
            >
              {sidebar}
            </aside>
          </>
        )}

        <main className="min-w-0 flex-1">
          <div className="border-b border-border-subtle bg-surface">
            <div className="mx-auto w-full max-w-[var(--layout-content-max)] px-3 sm:px-4 lg:px-6">
              <Breadcrumb pathname={pathname} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-[var(--layout-content-max)] p-3 sm:p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
