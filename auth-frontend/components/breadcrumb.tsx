'use client';

import Link from 'next/link';
import { breadcrumbFor } from '@/lib/navigation';

export default function Breadcrumb({ pathname }: { pathname: string }) {
  const crumbs = breadcrumbFor(pathname);

  return (
    <nav aria-label="Breadcrumb" className="py-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden="true">/</span>}
              {crumb.href && !current ? (
                <Link
                  href={crumb.href}
                  className="hover:text-brand-primary hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={current ? 'page' : undefined}
                  className={current ? 'font-medium text-brand-primary' : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
