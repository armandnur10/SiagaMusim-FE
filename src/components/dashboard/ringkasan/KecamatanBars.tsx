'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardHeader, LevelBadge } from '@/components/ui';
import { CITY_NAME, DISEASES } from '@/lib/config';
import { assessMany, countByLevel } from '@/lib/engines/risk';
import { fmtDec, fmtInt } from '@/lib/format';
import { rankAssessments } from '@/lib/summary';
import type { Assessment, Dataset, DiseaseId } from '@/types/ews';
import { niceMax, regionHref } from './helpers';

/** Ruang di kanan batang terpanjang untuk label nilai di ujung batang. */
const TIP_LABEL_SPACE = 52;

interface IncidenceBarProps {
  value: number;
  max: number;
  color: string;
}

/** Batang horizontal tipis dari garis dasar kiri; nilai ditulis di ujung batang dengan warna tinta. */
function IncidenceBar({ value, max, color }: IncidenceBarProps) {
  const ratio = Math.min(1, Math.max(0, value / max));
  return (
    <span className="flex h-5 min-w-0 items-center" style={{ paddingRight: TIP_LABEL_SPACE }}>
      <span className="relative block h-full w-full border-l border-line-strong">
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-r-[4px]"
          style={{ width: `${ratio * 100}%`, minWidth: value > 0 ? 2 : 0, backgroundColor: color }}
        />
        <span
          className="num absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-2 text-[13px] font-bold leading-5 text-ink"
          style={{ left: `${ratio * 100}%` }}
        >
          {fmtDec(value, 1)}
        </span>
      </span>
    </span>
  );
}

/**
 * Ponsel: nama + lencana, batang, lalu keterangan. Tablet: nama | lencana | batang, keterangan di baris kedua.
 * Desktop lebar (xl): semuanya satu baris.
 */
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 md:grid-cols-[minmax(0,10rem)_5.75rem_minmax(0,1fr)] xl:grid-cols-[minmax(0,10rem)_5.75rem_minmax(0,1fr)_5.5rem_minmax(0,13.5rem)_1rem]';
const META = 'col-span-2 flex flex-wrap gap-x-1.5 text-[13px] leading-5 text-muted md:col-span-3 xl:contents';

interface KecamatanBarsProps {
  ds: Dataset;
  disease: DiseaseId;
  weekIndex: number;
  /** Penilaian tingkat kota (baris pembanding). */
  city: Assessment;
}

/** Bagian D: perbandingan 10 kecamatan — insidensi per 100.000 penduduk, urut menurut urgensi. */
export function KecamatanBars({ ds, disease, weekIndex, city }: KecamatanBarsProps) {
  const d = DISEASES[disease];

  const rows = useMemo(
    () =>
      rankAssessments(assessMany(ds, ds.kecamatanIds, disease, weekIndex)).map((a) => {
        const region = ds.regions[a.regionId];
        const counts = countByLevel(assessMany(ds, region.childIds, disease, weekIndex));
        return { a, region, elevated: counts.siaga + counts.awas, total: region.childIds.length };
      }),
    [ds, disease, weekIndex],
  );

  const max = niceMax(Math.max(city.incidenceRate, ...rows.map((r) => r.a.incidenceRate)));

  return (
    <Card flush aria-label={`Perbandingan kecamatan: insidensi ${d.short} per 100.000 penduduk`}>
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <CardHeader
          title={`Per kecamatan: insidensi ${d.short} per 100.000 penduduk`}
          subtitle="Kasus baru minggu ini dibagi jumlah penduduk, agar kecamatan besar dan kecil bisa dibandingkan. Diurutkan dari yang paling perlu perhatian."
          className="!mb-3"
        />
      </div>

      <ol className="border-t border-line">
        {rows.map(({ a, region, elevated, total }) => (
          <li key={a.regionId} className="border-b border-line">
            <Link href={regionHref(a.regionId)} className={`${ROW_GRID} px-4 py-2.5 hover:bg-surface-2 focus-visible:-outline-offset-2 sm:px-5`}>
              <span className="min-w-0 text-[14px] font-bold leading-5 text-ink">
                <span className="sr-only">Kecamatan </span>
                {region.name}
              </span>
              <span className="justify-self-end md:justify-self-start">
                <LevelBadge level={a.level} size="sm" />
              </span>
              <span className="col-span-2 block min-w-0 md:col-span-1">
                <IncidenceBar value={a.incidenceRate} max={max} color={d.color} />
                <span className="sr-only"> per 100.000 penduduk</span>
              </span>
              <span className={META}>
                <span className="num xl:text-right">{fmtInt(a.cases)} kasus</span>
                <span className="xl:hidden" aria-hidden>
                  ·
                </span>
                <span className="min-w-0">
                  <span className={elevated > 0 ? 'font-semibold text-ink' : undefined}>{fmtInt(elevated)}</span> dari {fmtInt(total)} kelurahan
                  Siaga atau Awas
                </span>
              </span>
              <ChevronRight size={16} className="hidden text-muted xl:block" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>

      {/* Baris pembanding: angka seluruh kota pada skala yang sama, batang netral. */}
      <div className={`${ROW_GRID} px-4 py-3 sm:px-5`}>
        <span className="min-w-0 text-[13px] font-semibold leading-5 text-ink-2">Seluruh {CITY_NAME}</span>
        <span className="justify-self-end md:justify-self-start">
          <LevelBadge level={city.level} size="sm" />
        </span>
        <span className="col-span-2 block min-w-0 md:col-span-1">
          <IncidenceBar value={city.incidenceRate} max={max} color="var(--line-strong)" />
          <span className="sr-only"> per 100.000 penduduk</span>
        </span>
        <span className={META}>
          <span className="num xl:text-right">{fmtInt(city.cases)} kasus</span>
          <span className="xl:hidden" aria-hidden>
            ·
          </span>
          <span className="min-w-0">pembanding tingkat kota</span>
        </span>
        <span className="hidden xl:block" aria-hidden />
      </div>
    </Card>
  );
}
