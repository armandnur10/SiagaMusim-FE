'use client';

import type { MapMetric } from '@/components/map';
import { DISEASES } from '@/lib/config';
import type { Dataset, DiseaseId } from '@/types/ews';

const METRICS: { id: MapMetric; label: string }[] = [
  { id: 'level', label: 'Level peringatan' },
  { id: 'incidence', label: 'Insidensi' },
  { id: 'rain', label: 'Curah hujan' },
];

/** Satu kalimat: apa arti warna pada peta untuk besaran yang dipilih. */
function metricCaption(metric: MapMetric, disease: DiseaseId, isLatest: boolean): string {
  const d = DISEASES[disease];
  const when = isLatest ? 'minggu ini' : 'pada minggu yang dipilih';
  if (metric === 'incidence') {
    return `Kasus baru ${d.short} per 100.000 penduduk ${when} — membandingkan kelurahan secara adil.`;
  }
  if (metric === 'rain') {
    return `Curah hujan ${when} di tiap kelurahan. Dampaknya pada kasus ${d.short} biasanya muncul ${d.lagLabel} setelah hujan.`;
  }
  return `Level peringatan ${d.short} tiap kelurahan ${when}, gabungan sinyal kasus, cuaca, dan tren.`;
}

interface MapToolbarProps {
  dataset: Dataset;
  disease: DiseaseId;
  isLatest: boolean;
  metric: MapMetric;
  onMetricChange: (m: MapMetric) => void;
  focusKecamatanId: string | null;
  onFocusChange: (id: string | null) => void;
}

/** Bilah alat peta: besaran yang diwarnai + fokus kecamatan, dengan keterangan satu baris. */
export function MapToolbar({ dataset, disease, isLatest, metric, onMetricChange, focusKecamatanId, onFocusChange }: MapToolbarProps) {
  return (
    <div className="px-4 pb-3 pt-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div
          className="segmented flex w-full sm:inline-flex sm:w-auto lg:flex lg:w-full xl:inline-flex xl:w-auto [&>button]:min-h-[34px] [&>button]:flex-auto [&>button]:justify-center [&>button]:px-2.5 sm:[&>button]:px-3"
          role="group"
          aria-label="Besaran yang diwarnai pada peta"
        >
          {METRICS.map((m) => (
            <button key={m.id} type="button" aria-pressed={metric === m.id} onClick={() => onMetricChange(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <label className="block w-full sm:w-auto lg:w-full xl:w-auto">
          <span className="sr-only">Fokus kecamatan</span>
          <select
            className="field w-full"
            value={focusKecamatanId ?? ''}
            onChange={(e) => onFocusChange(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Semua kecamatan</option>
            {dataset.kecamatanIds.map((id) => (
              <option key={id} value={id}>
                Kec. {dataset.regions[id].name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[12.5px] leading-[18px] text-ink-2">{metricCaption(metric, disease, isLatest)}</p>
    </div>
  );
}
