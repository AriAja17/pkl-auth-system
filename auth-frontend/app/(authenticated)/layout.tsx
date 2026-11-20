'use client';

import AppShell from '@/components/app-shell';

/**
 * Route group (parentheses are not part of the URL). Every existing
 * authenticated route lives here and therefore shares one shell.
 * /login and /register stay in app/ and remain outside the shell.
 */
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
