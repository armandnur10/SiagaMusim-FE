'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RiskMap, type MapMetric } from '@/components/map';
import { PageHeader } from '@/components/shell';
import { DataGate } from '@/components/ui';
import { useDataset } from '@/lib/data/EwsDataProvider';
import { useFilters } from '@/lib/state/filters';
import { MapToolbar } from './MapToolbar';
import { KelurahanPanel, OverviewPanel } from './SidePanel';
import { TimeControl } from './TimeControl';

/**
 * Tata letak ruang kerja. Desktop: kartu peta + panel kanan setinggi sisa layar (panel
 * menggulung di dalam). Ponsel: satu kolom, tinggi mengikuti isi.
 */
const WORKSPACE_GRID =
  'grid grid-cols-1 gap-5 lg:h-[max(760px,calc(100vh-196px))] lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)] xl:h-[max(660px,calc(100vh-196px))] xl:grid-cols-[minmax(0,1fr)_372px]';
const MAP_AREA = 'relative h-[56vh] min-h-[340px] lg:h-auto lg:min-h-0 lg:flex-1';

function Workspace() {
  const ds = useDataset();
  const { disease, setDisease, weekIndex, isLatest } = useFilters();
  const [metric, setMetric] = useState<MapMetric>('level');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const selected = selectedId != null && ds.regions[selectedId]?.kind === 'kelurahan' ? selectedId : null;

  /** Klik pada peta. Kelurahan di luar kecamatan fokus memindahkan fokus ke kecamatannya. */
  const handleMapSelect = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id == null) return;
      const kec = ds.regions[id]?.kecamatanId ?? null;
      setFocusId((cur) => (cur != null && kec != null && cur !== kec ? kec : cur));
    },
    [ds],
  );

  /** Ganti fokus kecamatan; pilihan di luar kecamatan itu dilepas. */
  const handleFocusChange = useCallback(
    (id: string | null) => {
      setFocusId(id);
      if (id != null) setSelectedId((cur) => (cur != null && ds.regions[cur]?.kecamatanId !== id ? null : cur));
    },
    [ds],
  );

  /** Aksi dari dalam panel (pilih baris / tutup): panel berganti isi, jadi fokus papan ketik dipindah ke panel. */
  const selectFromPanel = useCallback((id: string | null) => {
    setSelectedId(id);
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  // Esc melepas pilihan.
  useEffect(() => {
    if (selected == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Isi panel berganti -> kembali ke atas.
  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [selected]);

  return (
    <div className={WORKSPACE_GRID}>
      <section className="card flex min-h-0 flex-col" aria-label="Peta dan pemutar waktu">
        <MapToolbar
          dataset={ds}
          disease={disease}
          isLatest={isLatest}
          metric={metric}
          onMetricChange={setMetric}
          focusKecamatanId={focusId}
          onFocusChange={handleFocusChange}
        />
        <div className={clsx(MAP_AREA, 'border-y border-line')}>
          <div className="absolute inset-0">
            <RiskMap
              dataset={ds}
              disease={disease}
              weekIndex={weekIndex}
              metric={metric}
              selectedId={selected}
              onSelect={handleMapSelect}
              focusKecamatanId={focusId}
            />
          </div>
        </div>
        <TimeControl />
      </section>

      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-label={selected ? `Rincian kelurahan ${ds.regions[selected].name}` : 'Ringkasan tampilan peta'}
        className="card flex min-h-0 flex-col overscroll-contain focus:outline-none lg:overflow-y-auto"
      >
        {selected ? (
          <KelurahanPanel
            dataset={ds}
            regionId={selected}
            disease={disease}
            weekIndex={weekIndex}
            onDiseaseChange={setDisease}
            onClose={() => selectFromPanel(null)}
          />
        ) : (
          <OverviewPanel dataset={ds} disease={disease} weekIndex={weekIndex} focusKecamatanId={focusId} onSelect={selectFromPanel} />
        )}
      </aside>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className={WORKSPACE_GRID} aria-busy="true" aria-label="Memuat peta risiko">
      <div className="card flex min-h-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <div className="skeleton h-10 w-full sm:w-80" />
          <div className="skeleton h-10 w-full sm:w-44" />
        </div>
        <div className={clsx(MAP_AREA, 'skeleton !rounded-none')} />
        <div className="grid gap-2.5 px-4 py-3.5 sm:px-5">
          <div className="skeleton h-12" />
          <div className="flex gap-3">
            <div className="skeleton h-10 w-28" />
            <div className="skeleton h-10 w-20" />
            <div className="skeleton h-10 w-44" />
          </div>
        </div>
      </div>
      <div className="card grid content-start gap-3 p-4 sm:p-5">
        <div className="skeleton h-14 w-2/3" />
        <div className="skeleton h-36" />
        <div className="skeleton h-16" />
        <div className="skeleton h-52" />
      </div>
    </div>
  );
}

export function PetaPage() {
  return (
    <>
      <PageHeader
        title="Peta risiko"
        description="Lihat di mana risiko berada, putar waktu untuk mengikuti penyebarannya, dan pilih kelurahan untuk rinciannya."
      />
      <DataGate fallback={<WorkspaceSkeleton />}>
        <Workspace />
      </DataGate>
    </>
  );
}
