'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Card, LevelBadge } from '@/components/ui';
import { DISEASES } from '@/lib/config';
import { fmtInt } from '@/lib/format';
import type { DiseaseSummary } from '@/lib/summary';
import type { Dataset } from '@/types/ews';
import { PRIORITY_COUNT, fmtThreshold, regionHref } from './helpers';
import { MORE_LINK } from './SectionHeader';

interface PriorityListProps {
  ds: Dataset;
  summary: DiseaseSummary;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

/** Bagian B (kanan): kelurahan yang paling perlu ditindak lebih dulu, urut dari yang paling mendesak. */
export function PriorityList({ ds, summary, selectedId, onSelect, className }: PriorityListProps) {
  const d = DISEASES[summary.disease];
  const total = summary.ranked.length;
  const aboveNormal = total - summary.counts.normal;
  const rows = summary.ranked.filter((a) => a.level !== 'normal').slice(0, PRIORITY_COUNT);

  return (
    <Card flush className={className} aria-labelledby="prioritas-judul">
      <div className="flex h-full flex-col">
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <header className="mb-3">
            <h2 id="prioritas-judul" className="text-[16px] font-bold leading-6 text-ink">
              Kelurahan prioritas
            </h2>
            <p className="mt-0.5 text-[13px] leading-5 text-ink-2">
              {rows.length > 0
                ? `${fmtInt(aboveNormal)} dari ${fmtInt(total)} kelurahan di atas Normal untuk ${d.short}. ${
                    aboveNormal > rows.length ? `Berikut ${rows.length} yang paling mendesak.` : 'Urut dari yang paling mendesak.'
                  }`
                : `Urutan kelurahan yang perlu ditindak lebih dulu untuk ${d.short}.`}
            </p>
          </header>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-2">
              <ShieldCheck size={22} strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-3 text-[15px] font-bold leading-6 text-ink">Tidak ada kelurahan di atas Normal</p>
            <p className="mt-1 max-w-[30ch] text-[13px] leading-5 text-ink-2">
              Seluruh {fmtInt(total)} kelurahan berada dalam pola wajar untuk {d.short} minggu ini. Lanjutkan pemantauan rutin.
            </p>
          </div>
        ) : (
          <ol className="flex-1 border-t border-line">
            {rows.map((a, i) => {
              const region = ds.regions[a.regionId];
              const selected = a.regionId === selectedId;
              return (
                <li
                  key={a.regionId}
                  className={clsx(
                    'relative flex gap-3 border-b border-line px-4 py-2.5 sm:px-5',
                    selected ? 'bg-surface-2' : 'hover:bg-surface-2',
                  )}
                >
                  {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ink" />}
                  <span className="num w-5 shrink-0 pt-px text-right text-[13px] font-bold leading-5 text-muted" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      {/* Tombol membentang ke seluruh baris (::after); tautan Profil berada di atasnya. */}
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onSelect(selected ? null : a.regionId)}
                        className="min-w-0 text-left text-[14px] font-bold leading-5 text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand"
                      >
                        <span className="sr-only">Peringkat {i + 1}: </span>
                        {region.name}
                        <span className="sr-only">, tandai di peta</span>
                      </button>
                      <LevelBadge level={a.level} size="sm" className="shrink-0" />
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-[13px] leading-5 text-ink-2">
                        Kec. {region.kecamatan} · kasus <span className="font-semibold text-ink">{fmtInt(a.cases)}</span> · ambang{' '}
                        {fmtThreshold(a.threshold)}
                      </p>
                      <Link
                        href={regionHref(a.regionId)}
                        className="relative z-10 inline-flex shrink-0 items-center gap-0.5 rounded text-[12px] font-semibold text-brand hover:text-brand-strong hover:underline"
                      >
                        Profil<span className="sr-only"> {region.name}</span>
                        <ArrowRight size={13} aria-hidden />
                      </Link>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-[18px] text-muted">{a.drivers[0]}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
          <p className="text-[12px] leading-5 text-muted">
            {rows.length > 0 && summary.counts.normal > 0 ? `${fmtInt(summary.counts.normal)} kelurahan berstatus Normal.` : ''}
          </p>
          <Link href="/dashboard/wilayah" className={MORE_LINK}>
            Lihat semua wilayah
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </Card>
  );
}
