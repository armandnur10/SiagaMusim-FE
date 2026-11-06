'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, Search } from 'lucide-react';
import { DataGate, DiseaseTag, LevelBadge, RecommendationList } from '@/components/ui';
import { CITY_NAME, DISEASES, DISEASE_IDS, LEVELS } from '@/lib/config';
import { useDataset, useEws } from '@/lib/data/EwsDataProvider';
import { fmtInt } from '@/lib/format';
import { assessRegionAll, summarizeAll } from '@/lib/summary';
import type { AlertLevel, Dataset, DiseaseId, RegionInfo } from '@/types/ews';
import { DiseaseSwitch } from './parts';
import { STATUS_PANEL_ID, useLandingSelection } from './selection';

const casesText = (n: number): string => (n > 0 ? `${fmtInt(n)} kasus minggu ini.` : 'Tidak ada kasus minggu ini.');
const sentence = (s: string): string => (/[.!?]$/.test(s) ? s : `${s}.`);

interface Row {
  disease: DiseaseId;
  level: AlertLevel;
  line: string;
}

function StatusRows({ rows }: { rows: Row[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((r) => (
        <li key={r.disease} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3.5">
          <DiseaseTag disease={r.disease} className="!text-[15px]" />
          <LevelBadge level={r.level} />
          <p className="col-span-2 text-[14px] leading-6 text-ink-2">{r.line}</p>
        </li>
      ))}
    </ul>
  );
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-4">
      <p className="eyebrow">Status minggu ini</p>
      <h2 className="mt-1 text-[22px] font-extrabold leading-7 tracking-tight text-ink">{title}</h2>
      <p className="mt-1 flex items-center gap-1.5 text-[14px] leading-5 text-ink-2">
        <MapPin size={14} aria-hidden className="shrink-0 text-muted" />
        {subtitle}
      </p>
    </header>
  );
}

/** Keadaan awal: belum ada kelurahan dipilih, tampilkan status seluruh kota. */
function CityPanel({ ds }: { ds: Dataset }) {
  const summary = useMemo(() => summarizeAll(ds), [ds]);
  const total = ds.kelurahanIds.length;
  const rows: Row[] = DISEASE_IDS.map((id) => {
    const s = summary[id];
    const spread =
      s.elevated > 0
        ? `${s.elevated} dari ${total} kelurahan berstatus Siaga atau Awas.`
        : 'Tidak ada kelurahan berstatus Siaga atau Awas.';
    return { disease: id, level: s.city.level, line: `${casesText(s.city.cases)} ${spread}` };
  });
  return (
    <>
      <PanelHeader title={CITY_NAME} subtitle={`Seluruh kota, ${total} kelurahan`} />
      <StatusRows rows={rows} />
      <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-brand-soft px-3.5 py-3 text-[14px] leading-6 text-brand-strong">
        <Search size={16} aria-hidden className="mt-1 shrink-0" />
        <span>Cari kelurahan Anda untuk melihat statusnya dan apa yang bisa Anda lakukan.</span>
      </p>
    </>
  );
}

function KelurahanPanel({ ds, region }: { ds: Dataset; region: RegionInfo }) {
  const { byDisease, worst } = useMemo(() => assessRegionAll(ds, region.id), [ds, region.id]);
  const [advice, setAdvice] = useState<DiseaseId>(worst.disease);
  const rows: Row[] = DISEASE_IDS.map((id) => {
    const a = byDisease[id];
    return { disease: id, level: a.level, line: `${casesText(a.cases)} ${sentence(a.drivers[0] ?? '')}`.trim() };
  });
  const adviceLevel = byDisease[advice].level;
  return (
    <>
      <PanelHeader title={`Kel. ${region.name}`} subtitle={`Kec. ${region.kecamatan ?? '–'}, ${CITY_NAME}`} />
      <StatusRows rows={rows} />

      <h3 className="mt-5 text-[16px] font-bold leading-6 text-ink">Yang bisa Anda lakukan</h3>
      <p className="mt-0.5 text-[13px] leading-5 text-ink-2">
        Saran untuk {DISEASES[advice].short} pada level {LEVELS[adviceLevel].label}.
      </p>
      <DiseaseSwitch value={advice} onChange={setAdvice} label="Penyakit untuk saran tindakan" className="mb-4 mt-3 flex w-full sm:inline-flex sm:w-auto" />
      <RecommendationList disease={advice} level={adviceLevel} only="warga" />

      <Link
        href={`/dashboard/wilayah/${region.id}`}
        className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-bold text-brand hover:text-brand-strong"
      >
        Lihat profil lengkap
        <ArrowRight size={16} aria-hidden />
      </Link>
    </>
  );
}

function PanelBody() {
  const ds = useDataset();
  const { selectedId } = useLandingSelection();
  const region = selectedId ? ds.regions[selectedId] : undefined;
  const kelurahan = region?.kind === 'kelurahan' ? region : undefined;
  return (
    <>
      <p className="sr-only" role="status">
        {kelurahan ? `Menampilkan status Kelurahan ${kelurahan.name}.` : ''}
      </p>
      {kelurahan ? <KelurahanPanel key={kelurahan.id} ds={ds} region={kelurahan} /> : <CityPanel ds={ds} />}
    </>
  );
}

function PanelSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat status minggu ini">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton mt-2 h-7 w-44" />
      <div className="skeleton mt-2 h-5 w-52" />
      <div className="mt-4 grid gap-3 border-y border-line py-3.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[62px]" />
        ))}
      </div>
      <div className="skeleton mt-4 h-[72px]" />
    </div>
  );
}

/**
 * Panel hasil di hero: status tiga penyakit untuk kelurahan terpilih beserta saran
 * tindakan; sebelum ada pilihan, menampilkan status seluruh kota.
 */
export function StatusPanel() {
  const { status } = useEws();
  // Saat gagal memuat, DataGate menampilkan kartu galatnya sendiri (tanpa kartu pembungkus ganda).
  if (status === 'error') return <DataGate>{null}</DataGate>;
  return (
    <section id={STATUS_PANEL_ID} aria-label="Status minggu ini" className="card scroll-mt-32 p-5 sm:scroll-mt-24 sm:p-6">
      <DataGate fallback={<PanelSkeleton />}>
        <PanelBody />
      </DataGate>
    </section>
  );
}
