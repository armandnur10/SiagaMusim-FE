'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DISEASE_ICONS, LevelBadge, LevelDot } from '@/components/ui';
import { CITY_NAME, DISEASES, DISEASE_IDS, LEVELS, LEVEL_ORDER } from '@/lib/config';
import { useDataset } from '@/lib/data/EwsDataProvider';
import { fmtInt } from '@/lib/format';
import { summarizeAll, type DiseaseSummary } from '@/lib/summary';
import { QuietGate } from './parts';
import { SectionHeading } from './SectionHeading';

/** Sebaran kelurahan per level: pita tipis + daftar angka berlabel (tidak pernah warna saja). */
function LevelBreakdown({ summary, total }: { summary: DiseaseSummary; total: number }) {
  return (
    <div className="mt-5 border-t border-line pt-4 sm:max-lg:mt-0 sm:max-lg:border-l sm:max-lg:border-t-0 sm:max-lg:pl-6 sm:max-lg:pt-0">
      <p className="text-[13px] font-semibold leading-5 text-ink-2">Sebaran {fmtInt(total)} kelurahan</p>
      <div aria-hidden className="mt-2.5 flex h-2 gap-[2px]">
        {LEVEL_ORDER.map((l) =>
          summary.counts[l] > 0 ? (
            <span
              key={l}
              className="min-w-[4px] rounded-[2px] first:rounded-l-full last:rounded-r-full"
              style={{ flexGrow: summary.counts[l], flexBasis: 0, backgroundColor: LEVELS[l].color }}
            />
          ) : null,
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
        {LEVEL_ORDER.map((l) => (
          <div key={l} className="flex min-w-0 flex-row-reverse items-center justify-end gap-2">
            <dt className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold leading-5 text-ink-2">
              <LevelDot level={l} size={8} />
              <span className="truncate">{LEVELS[l].label}</span>
            </dt>
            <dd className="num w-7 shrink-0 text-[18px] font-extrabold leading-7 text-ink">{fmtInt(summary.counts[l])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Cards() {
  const ds = useDataset();
  const summary = useMemo(() => summarizeAll(ds), [ds]);
  const total = ds.kelurahanIds.length;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {DISEASE_IDS.map((id) => {
        const d = DISEASES[id];
        const s = summary[id];
        const Icon = DISEASE_ICONS[id];
        return (
          <article key={id} className="card flex min-w-0 flex-col p-5 sm:max-lg:flex-row sm:max-lg:gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: d.colorSoft, color: d.colorText }}
                  >
                    <Icon size={20} aria-hidden />
                  </span>
                  <h3 className="truncate text-[17px] font-bold leading-6 text-ink">{d.short}</h3>
                </div>
                <LevelBadge level={s.city.level} size="lg" className="shrink-0" />
              </div>
              <p className="mt-4 text-[17px] font-bold leading-7 text-ink">{s.headline}</p>
              <p className="mt-2 text-[14px] leading-6 text-ink-2">{s.detail}</p>
            </div>
            <div className="flex shrink-0 flex-col sm:max-lg:w-[280px]">
              <LevelBreakdown summary={s} total={total} />
              <Link
                href={`/dashboard?penyakit=${d.id}`}
                className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[14px] font-bold text-brand hover:text-brand-strong sm:max-lg:ml-6 sm:max-lg:mt-auto"
              >
                Lihat {d.short} di dasbor
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat status kota" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-[400px] !rounded-[14px] sm:max-lg:h-[212px] lg:h-[420px]" />
      ))}
    </div>
  );
}

/** Status tingkat kota untuk tiga penyakit pada minggu terbaru. */
export function CityStatus() {
  return (
    <section aria-labelledby="status-kota-title">
      <SectionHeading id="status-kota-title" eyebrow="Tingkat kota" title={`Status ${CITY_NAME} minggu ini`} className="mb-5">
        Gambaran seluruh kota untuk tiga penyakit yang dipantau, beserta jumlah kelurahan pada tiap level.
      </SectionHeading>
      <QuietGate fallback={<CardsSkeleton />}>
        <Cards />
      </QuietGate>
    </section>
  );
}
