import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DISEASES, LEVELS, LEVEL_ORDER } from '@/lib/config';
import { fmtInt } from '@/lib/format';
import type { AlertLevel, Dataset, DiseaseId } from '@/types/ews';
import { fmtBreak, getRampScale, rangeLabels, type MapMetric } from './scales';

export interface MapLegendProps {
  metric: MapMetric;
  disease: DiseaseId;
  dataset: Dataset;
  /** Jumlah kelurahan per level (hanya ditampilkan pada metric 'level'). */
  counts?: Record<AlertLevel, number>;
  /** Default 'vertical'. */
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

/** Judul legenda untuk tiap besaran (dipakai juga sebagai nama aksesibel). */
export function legendTitle(metric: MapMetric, disease: DiseaseId): string {
  if (metric === 'incidence') return `Insidensi ${DISEASES[disease].short}/100 rb penduduk per minggu`;
  if (metric === 'rain') return 'Curah hujan (mm/minggu)';
  return 'Level peringatan';
}

// Garis tepi halus supaya kelas paling terang tetap terlihat di atas kartu putih.
const SWATCH_EDGE = 'inset 0 0 0 1px rgba(16, 32, 30, 0.12)';

const LEVELS_HIGH_TO_LOW: AlertLevel[] = [...LEVEL_ORDER].reverse();

function LevelLegend({ counts, horizontal }: { counts?: Record<AlertLevel, number>; horizontal: boolean }) {
  return (
    <ul className={horizontal ? 'flex flex-wrap items-center gap-x-3.5 gap-y-1' : 'flex flex-col gap-1'}>
      {LEVELS_HIGH_TO_LOW.map((id) => {
        const lv = LEVELS[id];
        return (
          <li key={id} className="flex items-center gap-2 text-ink">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-[4px]"
              style={{ backgroundColor: lv.color, boxShadow: SWATCH_EDGE }}
            />
            <span className="font-medium">{lv.label}</span>
            {counts && (
              <span className={clsx('num font-semibold text-ink-2', !horizontal && 'ml-auto pl-3')}>
                {fmtInt(counts[id])}
                <span className="sr-only"> kelurahan</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RampLegend({
  colors,
  breaks,
  horizontal,
}: {
  colors: readonly string[];
  breaks: readonly number[];
  horizontal: boolean;
}) {
  const labels = rangeLabels(breaks);

  if (!horizontal) {
    // Tertinggi di atas, sejajar dengan urutan Awas -> Normal pada legenda level.
    const rows = colors.map((color, i) => ({ color, label: labels[i] })).reverse();
    return (
      <ul className="flex flex-col gap-[3px]">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-ink">
            <span
              aria-hidden
              className="h-3 w-4 shrink-0 rounded-[3px]"
              style={{ backgroundColor: row.color, boxShadow: SWATCH_EDGE }}
            />
            <span className="num">{row.label}</span>
          </li>
        ))}
      </ul>
    );
  }

  const n = colors.length;
  return (
    <div style={{ minWidth: n * 28 }}>
      <div aria-hidden className="flex h-2.5 overflow-hidden rounded-[4px]" style={{ boxShadow: SWATCH_EDGE }}>
        {colors.map((color) => (
          <span key={color} className="h-full flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>
      {/* Angka batas tepat di bawah sambungan antarkelas. */}
      <div aria-hidden className="num relative mt-1 h-[14px] text-ink-2">
        {breaks.map((b, i) => (
          <span
            key={b}
            className="absolute top-0 -translate-x-1/2 leading-[14px]"
            style={{ left: `${((i + 1) / n) * 100}%` }}
          >
            {fmtBreak(b)}
          </span>
        ))}
      </div>
      <p className="sr-only">
        {n} kelas dari terang ke gelap: {labels.join('; ')}.
      </p>
    </div>
  );
}

/**
 * Legenda peta: kartu putih ringkas. Dipakai menumpang di atas <RiskMap> maupun berdiri
 * sendiri di halaman. Status selalu berlabel teks (tidak pernah warna saja).
 */
export function MapLegend({ metric, disease, dataset, counts, orientation = 'vertical', className }: MapLegendProps) {
  const title = legendTitle(metric, disease);
  const horizontal = orientation === 'horizontal';
  const scale = metric === 'level' ? null : getRampScale(metric, dataset, disease);

  return (
    <div
      role="group"
      aria-label={`Legenda: ${title}`}
      className={twMerge(
        'inline-block max-w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[11.5px] leading-4 shadow-card',
        className,
      )}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className={clsx('text-[11px] font-semibold text-ink-2', scale && horizontal && 'max-w-[196px]')}>{title}</p>
        {metric === 'level' && counts && !horizontal && (
          <span aria-hidden className="text-[10px] font-medium text-muted">
            kel.
          </span>
        )}
      </div>
      {scale ? (
        <RampLegend colors={scale.colors} breaks={scale.breaks} horizontal={horizontal} />
      ) : (
        <LevelLegend counts={counts} horizontal={horizontal} />
      )}
    </div>
  );
}
