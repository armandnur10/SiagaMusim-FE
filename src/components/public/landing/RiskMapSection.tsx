'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, ArrowUp, MousePointerClick, X } from 'lucide-react';
import { DiseaseTag, LevelBadge } from '@/components/ui';
import { DISEASES, DISEASE_IDS } from '@/lib/config';
import { useDataset } from '@/lib/data/EwsDataProvider';
import { fmtInt } from '@/lib/format';
import { assessRegionAll, summarizeDisease } from '@/lib/summary';
import type { Dataset, DiseaseId, RegionInfo } from '@/types/ews';
import { DiseaseSwitch, QuietGate } from './parts';
import { SectionHeading } from './SectionHeading';
import { STATUS_PANEL_ID, useLandingSelection } from './selection';

// MapLibre cukup besar dan butuh WebGL: dimuat hanya di peramban, setelah bagian lain tampil.
const RiskMap = dynamic(() => import('@/components/map').then((m) => m.RiskMap), {
  ssr: false,
  loading: () => <div aria-hidden className="skeleton absolute inset-0 !rounded-none" />,
});

const MAP_HEIGHT = 'h-[360px] sm:h-[440px] lg:h-[540px]';
/** Enam baris mengisi tinggi peta di desktop; di ponsel cukup empat. */
const TOP_COUNT = 6;
const TOP_COUNT_MOBILE = 4;

interface InfoProps {
  ds: Dataset;
  disease: DiseaseId;
  /** Memilih/membatalkan dari dalam kartu: isi kartu berganti, jadi fokus dipindah ke kartunya. */
  onPick: (id: string | null) => void;
}

function SelectedInfo({ ds, region, disease, onPick }: InfoProps & { region: RegionInfo }) {
  const { byDisease } = useMemo(() => assessRegionAll(ds, region.id), [ds, region.id]);
  const a = byDisease[disease];
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">Kelurahan terpilih</p>
          <h3 className="mt-1 text-[19px] font-extrabold leading-7 tracking-tight text-ink">Kel. {region.name}</h3>
          <p className="text-[14px] leading-5 text-ink-2">Kec. {region.kecamatan ?? '–'}</p>
        </div>
        <button
          type="button"
          onClick={() => onPick(null)}
          aria-label="Batalkan pilihan kelurahan"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {DISEASE_IDS.map((id) => (
          <li key={id} className="flex min-h-[48px] items-center justify-between gap-3 py-2">
            <DiseaseTag disease={id} className="!text-[14px]" />
            <LevelBadge level={byDisease[id].level} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[14px] leading-6 text-ink-2">
        <strong className="font-semibold text-ink">{DISEASES[disease].short}:</strong>{' '}
        {a.cases > 0 ? `${fmtInt(a.cases)} kasus minggu ini.` : 'tidak ada kasus minggu ini.'} {a.drivers[0]}.
      </p>

      <div className="mt-auto grid gap-1 pt-5">
        <a href={`#${STATUS_PANEL_ID}`} className="btn btn-primary min-h-[44px]">
          Lihat saran tindakan
          <ArrowUp size={16} aria-hidden />
        </a>
        <Link
          href={`/dashboard/wilayah/${region.id}`}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 text-[14px] font-bold text-brand hover:text-brand-strong"
        >
          Lihat profil lengkap
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </>
  );
}

function TopList({ ds, disease, onPick }: InfoProps) {
  const top = useMemo(() => summarizeDisease(ds, disease).ranked.slice(0, TOP_COUNT), [ds, disease]);
  return (
    <>
      <p className="flex items-start gap-2.5 text-[14px] leading-6 text-ink-2">
        <MousePointerClick size={18} aria-hidden className="mt-0.5 shrink-0 text-muted" />
        Ketuk atau klik satu kelurahan di peta untuk melihat statusnya.
      </p>
      <h3 className="mt-5 text-[16px] font-bold leading-6 text-ink">Paling perlu perhatian</h3>
      <p className="text-[13px] leading-5 text-ink-2">{DISEASES[disease].short}, minggu ini</p>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {top.map((a, i) => {
          const r = ds.regions[a.regionId];
          return (
            <li key={a.regionId} className={i >= TOP_COUNT_MOBILE ? 'hidden lg:list-item' : undefined}>
              <button
                type="button"
                onClick={() => onPick(a.regionId)}
                className="-mx-2 flex min-h-[56px] w-[calc(100%+16px)] items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold leading-5 text-ink">Kel. {r.name}</span>
                  <span className="block truncate text-[13px] leading-5 text-ink-2">Kec. {r.kecamatan}</span>
                </span>
                <LevelBadge level={a.level} size="sm" className="shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function MapBody({ disease }: { disease: DiseaseId }) {
  const ds = useDataset();
  const { selectedId, select } = useLandingSelection();
  const region = selectedId ? ds.regions[selectedId] : undefined;
  const kelurahan = region?.kind === 'kelurahan' ? region : undefined;
  const asideRef = useRef<HTMLElement>(null);
  const pickFromCard = (id: string | null) => {
    select(id);
    asideRef.current?.focus({ preventScroll: true });
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_332px]">
      <div className={`card relative min-w-0 overflow-hidden ${MAP_HEIGHT}`}>
        <RiskMap
          dataset={ds}
          disease={disease}
          weekIndex={ds.latestWeek}
          metric="level"
          selectedId={kelurahan?.id ?? null}
          onSelect={select}
          ariaLabel={`Peta level peringatan ${DISEASES[disease].short} per kelurahan, minggu terbaru`}
        />
      </div>
      <aside ref={asideRef} tabIndex={-1} aria-label="Rincian peta" className="card flex min-w-0 flex-col p-5 focus:outline-none">
        {kelurahan ? (
          <SelectedInfo ds={ds} region={kelurahan} disease={disease} onPick={pickFromCard} />
        ) : (
          <TopList ds={ds} disease={disease} onPick={pickFromCard} />
        )}
      </aside>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat peta" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_332px]">
      <div className={`skeleton !rounded-[14px] ${MAP_HEIGHT}`} />
      <div className="skeleton h-[340px] !rounded-[14px] lg:h-auto" />
    </div>
  );
}

/** Peta level peringatan per kelurahan; pilihan di peta dibagi dengan pencarian di hero. */
export function RiskMapSection() {
  const [disease, setDisease] = useState<DiseaseId>('dbd');
  return (
    <section aria-labelledby="peta-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <SectionHeading id="peta-title" eyebrow="Peta risiko" title="Lihat kelurahan di sekitar Anda">
          Setiap kelurahan diwarnai menurut level peringatannya minggu ini. Pilih penyakit untuk mengganti tampilan.
        </SectionHeading>
        <DiseaseSwitch value={disease} onChange={setDisease} label="Penyakit pada peta" className="flex w-full sm:inline-flex sm:w-auto" />
      </div>
      <QuietGate fallback={<MapSkeleton />}>
        <MapBody disease={disease} />
      </QuietGate>
    </section>
  );
}
