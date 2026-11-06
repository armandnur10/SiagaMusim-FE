'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { DummyDataPill } from '@/components/ui/DummyDataNotice';
import { useFilters } from '@/lib/state/filters';
import { DiseaseSwitcher } from './DiseaseSwitcher';
import { Logo, LogoMark } from './Logo';
import { DASHBOARD_NAV, isActive } from './nav';
import { WeekStepper } from './WeekStepper';

/**
 * Kerangka dasbor: sidebar gelap (≥ lg), bilah filter lengket di atas, navigasi bawah di ponsel.
 * Filter global (penyakit + minggu) berlaku untuk semua halaman dasbor.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { disease, setDisease } = useFilters();

  return (
    <div className="min-h-screen bg-bg lg:pl-[232px]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col bg-brand-deep lg:flex">
        <Link href="/" className="flex h-[68px] items-center px-5" aria-label="Siaga Musim — beranda">
          <Logo onDark />
        </Link>
        <nav className="flex-1 px-3 pt-2" aria-label="Navigasi dasbor">
          <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/45">Pemantauan</p>
          <ul className="grid gap-1">
            {DASHBOARD_NAV.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-semibold transition-colors',
                      active ? 'bg-white/[0.12] text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white',
                    )}
                  >
                    <item.icon size={18} strokeWidth={2} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="grid gap-1 border-t border-white/10 px-3 py-3">
          <Link
            href="/metodologi"
            className="flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
          >
            <BookOpen size={18} strokeWidth={2} aria-hidden />
            Metodologi
          </Link>
          <Link
            href="/"
            className="flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            Halaman publik
          </Link>
          <DummyDataPill onDark className="mx-3 mt-2 w-fit" />
        </div>
      </aside>

      {/* Bilah atas: filter global */}
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex min-h-[68px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link href="/" className="lg:hidden" aria-label="Siaga Musim — beranda">
            <LogoMark size={34} />
          </Link>
          <DiseaseSwitcher value={disease} onChange={setDisease} />
          <WeekStepper className="ml-auto" />
        </div>
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
        <div className="mx-auto w-full max-w-[1320px]">{children}</div>
      </main>

      {/* Navigasi bawah (ponsel & tablet) */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Navigasi dasbor"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {DASHBOARD_NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'flex h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-semibold',
                    active ? 'text-brand' : 'text-muted',
                  )}
                >
                  <item.icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden />
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  /** Satu-dua kalimat: apa yang bisa dilakukan di halaman ini. */
  description?: React.ReactNode;
  /** Kontrol halaman di sisi kanan. */
  actions?: React.ReactNode;
}

/** Judul halaman dasbor yang seragam. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-[24px] font-extrabold leading-8 tracking-tight text-ink sm:text-[28px] sm:leading-9">{title}</h1>
        {description && <p className="mt-1.5 text-[14px] leading-6 text-ink-2 sm:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
