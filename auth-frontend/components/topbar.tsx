'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { RoleView } from '@/lib/api-types';
import { Badge, Button } from '@/components/ui';

export type TopbarProps = {
  email: string;
  roles: RoleView[];
  onLogout: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
};

export default function Topbar({
  email,
  roles,
  onLogout,
  onToggleSidebar,
  sidebarOpen,
  menuButtonRef,
}: TopbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border-subtle bg-surface px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          aria-expanded={sidebarOpen}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border-strong text-text-secondary hover:bg-brand-primary-subtle md:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="truncate text-sm font-semibold text-text-primary">
          Workspace
        </span>
      </div>

      <div ref={profileRef} className="relative">
        <button
          type="button"
          onClick={() => setProfileOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          className="flex max-w-[60vw] items-center gap-2 rounded-sm border border-transparent px-2 py-1 text-sm text-text-secondary hover:border-border-subtle hover:bg-brand-primary-subtle sm:max-w-none"
        >
          <span className="truncate">{email}</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {profileOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border border-border-subtle bg-surface p-3 shadow-2"
          >
            <p className="truncate text-sm font-medium text-text-primary" title={email}>
              {email}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">Access role</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {roles.length === 0 ? (
                <span className="text-xs text-text-muted">Belum ada role</span>
              ) : (
                roles.map((role) => (
                  <Badge key={role.id} variant="access">
                    {role.name}
                    {role.isSystem ? ' · sistem' : ''}
                  </Badge>
                ))
              )}
            </div>
            <div className="mt-3 border-t border-border-subtle pt-3">
              <Button
                variant="ghost"
                size="sm"
                role="menuitem"
                className="w-full justify-start text-danger"
                onClick={onLogout}
              >
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
