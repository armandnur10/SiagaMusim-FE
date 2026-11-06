'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Logo } from './Logo';

const LINKS = [
  { href: '/', label: 'Status terkini' },
  { href: '/metodologi', label: 'Metodologi' },
];

export function PublicHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] w-full max-w-[1200px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Siaga Musim — beranda">
          <Logo />
        </Link>
        <nav className="ml-auto hidden items-center gap-1 sm:flex" aria-label="Navigasi utama">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? 'page' : undefined}
              className={clsx(
                'flex h-10 items-center rounded-[10px] px-3 text-[14px] font-semibold',
                pathname === l.href ? 'text-ink' : 'text-ink-2 hover:text-ink',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/dashboard" className="btn btn-primary ml-auto sm:ml-2">
          Buka dasbor
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      {/* Tautan ringkas untuk ponsel */}
      <nav className="flex gap-1 border-t border-line px-3 sm:hidden" aria-label="Navigasi utama">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={pathname === l.href ? 'page' : undefined}
            className={clsx(
              'flex h-11 items-center px-2 text-[13px] font-semibold',
              pathname === l.href ? 'text-ink shadow-[inset_0_-2px_0_var(--brand)]' : 'text-ink-2',
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
