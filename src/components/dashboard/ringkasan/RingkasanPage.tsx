'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shell';
import { DataGate } from '@/components/ui';
import { CITY_NAME } from '@/lib/config';
import { useDataset } from '@/lib/data/EwsDataProvider';
import { fmtWeekLong, fmtWeekRange } from '@/lib/format';
import { useFilters } from '@/lib/state/filters';
import { summarizeAll } from '@/lib/summary';
import { ActionsCard } from './ActionsCard';
import { KecamatanBars } from './KecamatanBars';
import { MapCard } from './MapCard';
import { PriorityList } from './PriorityList';
import { RainCasesCard } from './RainCasesCard';
import { RingkasanSkeleton } from './RingkasanSkeleton';
import { SituationBand } from './SituationBand';
import { StatusCards } from './StatusCards';

function RingkasanContent() {
  const ds = useDataset();
  const { disease, setDisease, weekIndex, setWeekIndex } = useFilters();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const summaries = useMemo(() => summarizeAll(ds, weekIndex), [ds, weekIndex]);
  const summary = summaries[disease];

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* A. Bagaimana kondisi tiga penyakit minggu ini */}
      <StatusCards ds={ds} summaries={summaries} weekIndex={weekIndex} disease={disease} onSelectDisease={setDisease} />

      {/* B. Di mana harus bertindak lebih dulu */}
      <SituationBand summary={summary} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <MapCard
          ds={ds}
          disease={disease}
          weekIndex={weekIndex}
          selectedId={selectedId}
          onSelect={setSelectedId}
          className="order-2 xl:order-1 xl:col-span-7"
        />
        <PriorityList
          ds={ds}
          summary={summary}
          selectedId={selectedId}
          onSelect={setSelectedId}
          className="order-1 xl:order-2 xl:col-span-5"
        />
      </div>

      {/* C + E. Mengapa, dan apa yang perlu dilakukan */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <RainCasesCard
          ds={ds}
          disease={disease}
          weekIndex={weekIndex}
          city={summary.city}
          onSelectWeek={setWeekIndex}
          className="xl:col-span-8"
        />
        <ActionsCard ds={ds} summary={summary} className="xl:col-span-4" />
      </div>

      {/* D. Perbandingan kecamatan */}
      <KecamatanBars ds={ds} disease={disease} weekIndex={weekIndex} city={summary.city} />
    </div>
  );
}

export function RingkasanPage() {
  const { week, isLatest } = useFilters();

  let description: React.ReactNode = `Kondisi DBD, muntaber, dan influenza di ${CITY_NAME} beserta wilayah yang perlu ditindak lebih dulu.`;
  if (week) {
    const label = (
      <strong className="font-semibold text-ink">
        {fmtWeekLong(week)} ({fmtWeekRange(week)})
      </strong>
    );
    description = isLatest ? (
      <>
        Kondisi {CITY_NAME} pada {label}, minggu data terbaru.
      </>
    ) : (
      <>
        Anda sedang melihat data lampau: {label}. Semua angka di halaman ini mengikuti minggu tersebut, bukan minggu terbaru.
      </>
    );
  }

  return (
    <>
      <PageHeader title="Ringkasan" description={description} />
      <DataGate fallback={<RingkasanSkeleton />}>
        <RingkasanContent />
      </DataGate>
    </>
  );
}
