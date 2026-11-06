'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { ChartLegend, Sparkline, useElementWidth, type LegendItem } from '@/components/charts';
import { Card, CardHeader, LevelBadge } from '@/components/ui';
import { DISEASES, LEVELS } from '@/lib/config';
import { assess, baselineSeries } from '@/lib/engines/risk';
import { fmtDec, fmtInt } from '@/lib/format';
import type { Dataset, DiseaseId } from '@/types/ews';

const SPARK_WEEKS = 52;
const SPARK_HEIGHT = 44;

interface KecamatanMultiplesProps {
  ds: Dataset;
  disease: DiseaseId;
  weekIndex: number;
  /** Wilayah yang sedang dipilih di halaman (kota/kecamatan/kelurahan). */
  regionId: string;
  onSelect: (kecamatanId: string) => void;
}

/** Sparkline selebar wadahnya (lebar panel berubah menurut layar). */
function FluidSparkline({ values, threshold, color, label }: { values: number[]; threshold: number[]; color: string; label: string }) {
  const [ref, width] = useElementWidth<HTMLSpanElement>();
  return (
    <span ref={ref} className="block w-full" style={{ height: SPARK_HEIGHT }}>
      {width > 0 && <Sparkline values={values} threshold={threshold} color={color} width={width} height={SPARK_HEIGHT} ariaLabel={label} />}
    </span>
  );
}

/** "Bandingkan kecamatan": sepuluh panel kecil dengan pengodean visual yang sama persis. */
export function KecamatanMultiples({ ds, disease, weekIndex, regionId, onSelect }: KecamatanMultiplesProps) {
  const d = DISEASES[disease];
  const selected = ds.regions[regionId];
  const from = Math.max(0, weekIndex - SPARK_WEEKS + 1);
  const span = weekIndex - from + 1;

  const panels = useMemo(
    () =>
      ds.kecamatanIds.map((id) => {
        const a = assess(ds, id, disease, weekIndex);
        const base = baselineSeries(ds, id, disease);
        return {
          id,
          name: ds.regions[id].name,
          assessment: a,
          values: ds.series[id].cases[disease].slice(from, weekIndex + 1),
          threshold: base.threshold.slice(from, weekIndex + 1),
        };
      }),
    [ds, disease, weekIndex, from],
  );

  const legend: LegendItem[] = [
    { id: 'cases', label: `Kasus ${d.short} per minggu`, kind: 'line', color: d.color },
    { id: 'thr', label: 'Ambang historis', kind: 'dash', color: 'var(--muted)' },
    { id: 'now', label: 'Minggu yang dilihat', kind: 'dot', color: d.color },
  ];

  return (
    <Card>
      <CardHeader
        title="Bandingkan kecamatan"
        subtitle={`Kasus ${d.short} ${fmtInt(span)} minggu terakhir di tiap kecamatan: apakah garisnya menembus ambang putus-putus? Pilih satu panel untuk membuka grafiknya di atas.`}
      />
      <ChartLegend items={legend} className="mb-3" />
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {panels.map((p) => {
          const isSelected = p.id === regionId;
          const isParent = selected.kind === 'kelurahan' && selected.kecamatanId === p.id;
          const a = p.assessment;
          return (
            <li key={p.id} className="min-w-0">
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(p.id)}
                className={clsx(
                  'flex h-full w-full min-w-0 flex-col rounded-xl border p-3 text-left transition-colors',
                  isSelected ? 'border-brand bg-brand-soft/50 shadow-[inset_0_0_0_1px_var(--brand)]' : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
                )}
              >
                <span className="flex items-start justify-between gap-1.5">
                  <span className="min-w-0 break-words text-[14px] font-bold leading-5 text-ink">{p.name}</span>
                  {isSelected && (
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                      <Check size={11} strokeWidth={3} aria-hidden />
                    </span>
                  )}
                </span>
                <span className="mt-1.5 block">
                  <LevelBadge level={a.level} size="sm" />
                </span>
                <span className="mt-2 block text-[12.5px] leading-[18px] text-ink-2">
                  <strong className="text-[15px] font-bold text-ink">{fmtInt(a.cases)}</strong> kasus
                  <span className="block whitespace-nowrap">{fmtDec(a.incidenceRate, 1)} per 100 rb</span>
                </span>
                {isParent && <span className="mt-0.5 block text-[12px] leading-4 text-muted">Mencakup {selected.name}</span>}
                <span className="mt-auto block pt-2.5">
                  <FluidSparkline
                    values={p.values}
                    threshold={p.threshold}
                    color={d.color}
                    label={`Kasus ${d.short} ${fmtInt(span)} minggu terakhir di Kec. ${p.name}: minggu ini ${fmtInt(a.cases)} kasus, ambang ${fmtDec(a.threshold, 1)}, status ${LEVELS[a.level].label}`}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[12.5px] leading-[18px] text-muted">
        Tinggi garis memakai skala tiap kecamatan sendiri. Bandingkan bentuk garis dan posisinya terhadap ambang, bukan tinggi antarpanel.
      </p>
    </Card>
  );
}
