'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shell';
import { DataGate, DiseaseTag } from '@/components/ui';
import { useDataset } from '@/lib/data/EwsDataProvider';
import { forecast as computeForecast } from '@/lib/engines/forecast';
import { assess, baselineSeries, levelHistory, prepare } from '@/lib/engines/risk';
import { fmtWeekLong, fmtWeekRange } from '@/lib/format';
import { useFilters } from '@/lib/state/filters';
import type { Dataset } from '@/types/ews';
import { KecamatanMultiples } from './KecamatanMultiples';
import { LagCard } from './LagCard';
import { RainCaseCard } from './RainCaseCard';
import { SeasonalCard } from './SeasonalCard';
import { StatTiles } from './StatTiles';
import { TrenFilters } from './TrenFilters';
import { TrenSkeleton } from './TrenSkeleton';
import { regionTitle, resolveRange, type RangeId } from './helpers';

const resolveRegion = (ds: Dataset, id: string | null): string => (id && ds.regions[id] ? id : ds.cityId);

function TrenContent({ wilayahParam }: { wilayahParam: string | null }) {
  const ds = useDataset();
  const { disease, weekIndex, week, isLatest, setWeekIndex } = useFilters();

  // Wilayah = state lokal halaman; nilai awalnya dari ?wilayah=<id> (tautan dari halaman lain).
  const [regionId, setRegionId] = useState<string>(() => resolveRegion(ds, wilayahParam));
  const [seenParam, setSeenParam] = useState(wilayahParam);
  if (wilayahParam !== seenParam) {
    setSeenParam(wilayahParam);
    setRegionId(resolveRegion(ds, wilayahParam));
  }
  const [rangeId, setRangeId] = useState<RangeId>('52');

  const region = ds.regions[regionId];
  const name = regionTitle(region);
  const range = useMemo(() => resolveRange(rangeId, weekIndex), [rangeId, weekIndex]);

  const assessment = assess(ds, regionId, disease, weekIndex);
  const fc = computeForecast(ds, regionId, disease, weekIndex);
  const baseline = useMemo(() => baselineSeries(ds, regionId, disease), [ds, regionId, disease]);
  const levels = useMemo(() => levelHistory(ds, regionId, disease, range.from, range.to), [ds, regionId, disease, range.from, range.to]);
  const rainNormal = prepare(ds, regionId, disease).rainClim[ds.weeks[weekIndex].isoWeek] ?? 0;

  const mainRef = useRef<HTMLDivElement | null>(null);
  const selectKecamatan = useCallback((id: string) => {
    setRegionId(id);
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mainRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, []);

  return (
    <div className="grid grid-cols-1 gap-5">
      <TrenFilters ds={ds} regionId={regionId} onRegionChange={setRegionId} range={rangeId} onRangeChange={setRangeId} />

      <section aria-label="Ringkasan angka" className="min-w-0">
        <p className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] leading-5 text-ink-2">
          <DiseaseTag disease={disease} variant="chip" />
          <span>
            <strong className="font-semibold text-ink">{name}</strong>
            {week && (
              <>
                {' '}
                · {fmtWeekLong(week)} ({fmtWeekRange(week)})
              </>
            )}
            {!isLatest && ' · minggu lampau, bukan minggu terbaru'}
          </span>
        </p>
        <StatTiles disease={disease} assessment={assessment} forecast={fc} rainNormal={rainNormal} />
      </section>

      <RainCaseCard
        ds={ds}
        regionId={regionId}
        regionName={name}
        disease={disease}
        range={range}
        expected={baseline.expected}
        threshold={baseline.threshold}
        levels={levels}
        forecast={fc.points}
        weekIndex={weekIndex}
        onSelectWeek={setWeekIndex}
        anchorRef={mainRef}
      />

      <LagCard ds={ds} regionId={regionId} disease={disease} onRegionChange={setRegionId} />

      <SeasonalCard ds={ds} regionId={regionId} disease={disease} weekIndex={weekIndex} />

      <KecamatanMultiples ds={ds} disease={disease} weekIndex={weekIndex} regionId={regionId} onSelect={selectKecamatan} />
    </div>
  );
}

/** Membaca ?wilayah=<id>. Harus berada di dalam <Suspense> (aturan useSearchParams pada rute statis). */
function TrenFromUrl() {
  const params = useSearchParams();
  return (
    <DataGate fallback={<TrenSkeleton />}>
      <TrenContent wilayahParam={params.get('wilayah')} />
    </DataGate>
  );
}

export function TrenPage() {
  return (
    <>
      <PageHeader
        title="Tren & cuaca"
        description="Lihat bagaimana kasus bergerak mengikuti hujan: dibanding pola normal dan ambangnya, berapa minggu hujan mendahului kasus, dan perkiraan empat minggu ke depan."
      />
      <Suspense fallback={<TrenSkeleton />}>
        <TrenFromUrl />
      </Suspense>
    </>
  );
}
