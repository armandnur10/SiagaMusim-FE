'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { RainCaseChart } from '@/components/charts';
import { Card } from '@/components/ui';
import { DISEASES, rainIntensityLabel } from '@/lib/config';
import { forecast } from '@/lib/engines/forecast';
import { baselineSeries } from '@/lib/engines/risk';
import { fmtDec, fmtInt, fmtRain, fmtSignedPct } from '@/lib/format';
import type { Assessment, Dataset, DiseaseId } from '@/types/ews';
import { CHART_WEEKS } from './helpers';
import { MORE_LINK, SectionHeader } from './SectionHeader';
import { useIsDesktop } from './useIsDesktop';

interface FigureProps {
  label: string;
  value: string;
  note: string;
}

/** Angka kecil berlabel (gaya sama dengan kotak statistik halaman Data). */
function Figure({ label, value, note }: FigureProps) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <dt className="text-[12px] font-semibold leading-4 text-muted">{label}</dt>
      <dd className="mt-1">
        <span className="block text-[20px] font-extrabold leading-7 tracking-tight text-ink">{value}</span>
        <span className="mt-0.5 block text-[12px] leading-[18px] text-ink-2">{note}</span>
      </dd>
    </div>
  );
}

/** Spasi tak-terputus supaya satuan tidak terpisah baris dari angkanya. */
const nb = (text: string): string => text.replace(/ /g, '\u00a0');

function trendNote(a: Assessment): string {
  const pct = Math.round(a.trendPct);
  if (pct === 0) return 'Setara dengan 3 minggu sebelumnya';
  // trendPct dibatasi mesin risiko pada +150%: di batas itu, tulis sebagai batas bawah.
  if (pct >= 150) return 'Naik lebih dari 150% dibanding 3 minggu sebelumnya';
  return `${fmtSignedPct(pct)} dibanding 3 minggu sebelumnya`;
}

interface RainCasesCardProps {
  ds: Dataset;
  disease: DiseaseId;
  weekIndex: number;
  /** Penilaian tingkat kota untuk penyakit & minggu ini. */
  city: Assessment;
  onSelectWeek: (weekIndex: number) => void;
  className?: string;
}

/** Bagian C: mengapa — curah hujan dan kasus tingkat kota pada satu sumbu waktu, plus tiga angka kunci. */
export function RainCasesCard({ ds, disease, weekIndex, city, onSelectWeek, className }: RainCasesCardProps) {
  const d = DISEASES[disease];
  const isDesktop = useIsDesktop();
  const series = ds.series[ds.cityId];
  const baseline = useMemo(() => baselineSeries(ds, ds.cityId, disease), [ds, disease]);
  const fc = forecast(ds, ds.cityId, disease, weekIndex);
  const range = useMemo(() => ({ from: Math.max(0, weekIndex - CHART_WEEKS + 1), to: weekIndex }), [weekIndex]);

  const ratio = city.rainExposureNormal > 0 ? city.rainExposure / city.rainExposureNormal : null;

  return (
    <Card className={className} aria-label={`Mengapa: hujan dan kasus ${d.short} tingkat kota`}>
      <SectionHeader
        title={`Mengapa: hujan dan kasus ${d.short} tingkat kota`}
        subtitle={
          <>
            Kasus {d.short} biasanya mengikuti hujan {d.lagLabel} sebelumnya.{' '}
            {isDesktop
              ? 'Arahkan kursor ke satu minggu untuk melihat hujan pemicunya, klik untuk berpindah ke minggu itu.'
              : 'Ketuk satu minggu untuk melihat hujan pemicunya dan berpindah ke minggu itu.'}
          </>
        }
        action={
          <Link href="/dashboard/tren" className={MORE_LINK}>
            Analisis tren lengkap
            <ArrowRight size={15} aria-hidden />
          </Link>
        }
      />

      <RainCaseChart
        weeks={ds.weeks}
        rain={series.rain}
        cases={series.cases[disease]}
        disease={disease}
        range={range}
        expected={baseline.expected}
        threshold={baseline.threshold}
        forecast={fc.points}
        selectedWeek={weekIndex}
        onSelectWeek={onSelectWeek}
        height={340}
      />

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Figure
          label="Hujan minggu ini"
          value={fmtRain(city.rainThisWeek)}
          note={`${rainIntensityLabel(city.rainThisWeek)} · rata-rata seluruh kota`}
        />
        <Figure
          label="Paparan hujan terkini"
          value={ratio === null ? fmtRain(city.rainExposure) : `${fmtDec(ratio, 1)}× normal`}
          note={`${nb(fmtRain(city.rainExposure))} per minggu, normalnya ${nb(fmtRain(city.rainExposureNormal))}`}
        />
        <Figure
          label="Tren kasus 3 minggu"
          value={`${fmtInt(city.casesPrev3)} → ${fmtInt(city.casesRecent3)}`}
          note={trendNote(city)}
        />
      </dl>
    </Card>
  );
}
