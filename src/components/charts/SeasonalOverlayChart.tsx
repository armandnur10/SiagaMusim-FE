'use client';

import { useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { line } from 'd3-shape';
import { fmtInt, fmtMonth, fmtWeekRange } from '@/lib/format';
import type { WeekInfo } from '@/types/ews';
import { ChartLegend, type LegendItem } from './ChartLegend';
import { ChartTooltip, TooltipHeader, TooltipRow } from './ChartTooltip';
import { clamp, fmtValue, isNum, niceAxis, safeMax, spreadLabels } from './chartUtils';
import { useElementWidth, useOutsideDismiss } from './useElementWidth';

export interface SeasonalOverlayChartProps {
  weeks: WeekInfo[];
  /** Nilai per minggu, sejajar indeks dengan `weeks`. */
  values: number[];
  /** Warna tahun yang disorot (mis. DISEASES[d].color atau RAIN.color). */
  color: string;
  /** Satuan pada tooltip, mis. 'kasus' atau 'mm'. */
  unit: string;
  /** Judul sumbu-y, mis. 'Kasus baru/minggu'. */
  valueLabel: string;
  /** Tinggi total SVG px. Default 280. Legenda berada di atasnya. */
  height?: number;
  /** Tahun ISO yang disorot. Default = tahun ISO terbaru pada data. */
  highlightYear?: number;
  ariaLabel?: string;
}

const WEEKS_PER_YEAR = 52;
/** Hari-ke-N awal tiap bulan (tahun biasa) + batas akhir tahun. */
const MONTH_START_DOY = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
const MONTH_LABELS = Array.from({ length: 12 }, (_, m) => fmtMonth(`2023-${String(m + 1).padStart(2, '0')}-01`));
/** Posisi (dalam koordinat minggu 1..52) untuk hari-ke-N. */
const doyToWeek = (doy: number): number => clamp(doy / 7 + 0.5, 1, WEEKS_PER_YEAR);

interface YearSeries {
  year: number;
  /** Indeks 0..51 = minggu ISO 1..52 (minggu 53 dirata-ratakan ke minggu 52). */
  values: (number | null)[];
  info: (WeekInfo | null)[];
  lastWeek: number; // 1..52, 0 bila kosong
  highlight: boolean;
  opacity: number;
}

function buildYears(weeks: WeekInfo[], values: number[], highlightYear: number | undefined): YearSeries[] {
  const n = Math.min(weeks.length, values.length);
  const map = new Map<number, { sum: number[]; cnt: number[]; info: (WeekInfo | null)[] }>();
  for (let i = 0; i < n; i++) {
    const w = weeks[i];
    const v = values[i];
    if (!w || !isNum(v) || !isNum(w.isoYear) || !isNum(w.isoWeek)) continue;
    const slot = clamp(Math.round(w.isoWeek), 1, WEEKS_PER_YEAR) - 1;
    let y = map.get(w.isoYear);
    if (!y) {
      y = { sum: new Array<number>(WEEKS_PER_YEAR).fill(0), cnt: new Array<number>(WEEKS_PER_YEAR).fill(0), info: new Array<WeekInfo | null>(WEEKS_PER_YEAR).fill(null) };
      map.set(w.isoYear, y);
    }
    y.sum[slot] += v;
    y.cnt[slot] += 1;
    if (!y.info[slot]) y.info[slot] = w;
  }
  const years = [...map.keys()].sort((a, b) => a - b);
  if (years.length === 0) return [];
  const latest = years[years.length - 1];
  const hl = isNum(highlightYear) && map.has(highlightYear) ? highlightYear : latest;
  const others = years.filter((y) => y !== hl);
  return years.map((year) => {
    const y = map.get(year)!;
    const vals = y.sum.map((s, k) => (y.cnt[k] > 0 ? s / y.cnt[k] : null));
    let lastWeek = 0;
    vals.forEach((v, k) => {
      if (v !== null) lastWeek = k + 1;
    });
    const rank = others.indexOf(year);
    return {
      year,
      values: vals,
      info: y.info,
      lastWeek,
      highlight: year === hl,
      // Tahun pembanding: abu-abu netral, makin lama makin pudar.
      opacity: year === hl ? 1 : others.length <= 1 ? 0.6 : 0.35 + 0.45 * (rank / (others.length - 1)),
    };
  });
}

/** Perbandingan antartahun: satu garis per tahun ISO pada sumbu minggu 1-52; satu tahun disorot. */
export function SeasonalOverlayChart(props: SeasonalOverlayChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const height = Math.max(160, props.height ?? 280);
  const years = useMemo(() => buildYears(props.weeks, props.values, props.highlightYear), [props.weeks, props.values, props.highlightYear]);
  const hl = years.find((y) => y.highlight);
  const label =
    props.ariaLabel ??
    (years.length === 0
      ? `${props.valueLabel}: belum ada data`
      : `${props.valueLabel} per minggu epidemiologi, perbandingan tahun ${years.map((y) => y.year).join(', ')}.` +
        (hl && years.length > 1 ? ` Tahun ${hl.year} disorot.` : ''));

  return (
    <div ref={ref} className="w-full min-w-0">
      {years.length === 0 ? (
        <div role="img" aria-label={label} className="flex items-center justify-center text-[13px] text-muted" style={{ height }}>
          Belum ada data untuk ditampilkan
        </div>
      ) : width > 0 ? (
        <SeasonalPlot years={years} color={props.color} unit={props.unit} valueLabel={props.valueLabel} width={width} height={height} label={label} />
      ) : (
        <div style={{ height }} aria-hidden="true" />
      )}
    </div>
  );
}

interface SeasonalPlotProps {
  years: YearSeries[];
  color: string;
  unit: string;
  valueLabel: string;
  width: number;
  height: number;
  label: string;
}

const NEUTRAL = 'var(--muted)';

function SeasonalPlot({ years, color, unit, valueLabel, width, height, label }: SeasonalPlotProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ w: number; y: number | null } | null>(null);
  useOutsideDismiss(rootRef, hover !== null, () => setHover(null));

  const g = useMemo(() => {
    const allValues = years.flatMap((y) => y.values);
    const integer = allValues.every((v) => v === null || Number.isInteger(v));
    const axis = niceAxis(0, safeMax(allValues), 4, integer, 4);
    const tickLabels = axis.ticks.map(fmtValue);
    const left = Math.max(28, Math.ceil(Math.max(...tickLabels.map((t) => t.length)) * 6.4) + 10);
    const right = 42;
    const top = 24;
    const bottom = 24;
    const plotW = Math.max(10, width - left - right);
    const plotH = Math.max(40, height - top - bottom);
    const x = (w: number) => left + ((clamp(w, 1, WEEKS_PER_YEAR) - 1) / (WEEKS_PER_YEAR - 1)) * plotW;
    const y = (v: number) => top + (1 - clamp(v, 0, axis.max) / axis.max) * plotH;

    const gen = line<number | null>()
      .defined((v) => v !== null)
      .x((_, k) => x(k + 1))
      .y((v) => y(v ?? 0));

    // Tahun pembanding dulu, tahun sorotan paling atas.
    const ordered = [...years].sort((a, b) => Number(a.highlight) - Number(b.highlight) || a.year - b.year);
    const series = ordered.map((s) => ({ ...s, d: gen(s.values) ?? '' }));

    // Label ujung garis: di kolom margin kanan bila garis berakhir dekat tepi, selain itu tepat di samping titik akhir.
    const ends = series
      .filter((s) => s.lastWeek > 0)
      .map((s) => {
        const px = x(s.lastWeek);
        const py = y(s.values[s.lastWeek - 1] ?? 0);
        return { year: s.year, highlight: s.highlight, opacity: s.opacity, px, py, inMargin: px >= left + plotW - 30 };
      });
    const marginEnds = ends.filter((e) => e.inMargin);
    const spread = spreadLabels(
      marginEnds.map((e) => e.py),
      12,
      top + 4,
      top + plotH - 2,
    );
    const endLabels = ends.map((e) => {
      const k = marginEnds.indexOf(e);
      return k >= 0 ? { ...e, lx: left + plotW + 9, ly: spread[k] } : { ...e, lx: e.px + 9, ly: e.py };
    });

    const perMonth = plotW / 12;
    const monthStep = perMonth >= 30 ? 1 : perMonth >= 15 ? 2 : 3;
    const months = MONTH_LABELS.map((text, m) => ({
      m,
      text,
      boundaryX: x(doyToWeek(MONTH_START_DOY[m])),
      midX: x(doyToWeek((MONTH_START_DOY[m] + MONTH_START_DOY[m + 1]) / 2)),
      show: m % monthStep === 0,
    }));

    return { axis, tickLabels, left, right, top, plotW, plotH, bottomY: top + plotH, x, y, series, endLabels, months };
  }, [years, width, height]);

  const legendItems = useMemo<LegendItem[]>(
    () =>
      [...years]
        .sort((a, b) => Number(b.highlight) - Number(a.highlight) || b.year - a.year)
        .map((s) => ({
          id: String(s.year),
          label: String(s.year),
          kind: 'line' as const,
          color: s.highlight ? color : NEUTRAL,
          opacity: s.opacity,
        })),
    [years, color],
  );

  const weekAt = (e: PointerEvent<HTMLDivElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - rect.left - g.left) / g.plotW;
    return clamp(Math.round(t * (WEEKS_PER_YEAR - 1)) + 1, 1, WEEKS_PER_YEAR);
  };
  const track = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const w = weekAt(e);
    const y = Math.round((e.clientY - rect.top) / 4) * 4;
    setHover((prev) => (prev && prev.w === w && prev.y === y ? prev : { w, y }));
  };
  const defaultWeek = years.find((s) => s.highlight)?.lastWeek || WEEKS_PER_YEAR;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = hover?.w ?? defaultWeek;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = hover ? cur - 1 : cur;
    else if (e.key === 'ArrowRight') next = hover ? cur + 1 : cur;
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = WEEKS_PER_YEAR;
    else if (e.key === 'Escape') setHover(null);
    if (next !== null) {
      e.preventDefault();
      setHover({ w: clamp(next, 1, WEEKS_PER_YEAR), y: null });
    }
  };
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) {
      setHover((prev) => prev ?? { w: defaultWeek, y: null });
    }
  };

  const staticLayer = useMemo(() => {
    const textProps = { fontSize: 11, fill: 'var(--muted)' } as const;
    return (
      <g>
        {g.axis.ticks.map((t, k) => {
          const y = Math.round(g.y(t)) + 0.5;
          return (
            <g key={t}>
              <line x1={g.left} x2={g.left + g.plotW} y1={y} y2={y} stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth={1} />
              <text x={g.left - 6} y={y} dy="0.32em" textAnchor="end" className="num" {...textProps}>
                {g.tickLabels[k]}
              </text>
            </g>
          );
        })}
        <text x={0} y={11} fontSize={11} fill="var(--ink-2)" fontWeight={600}>
          {valueLabel}
        </text>

        {g.months.map((mo) => (
          <g key={mo.m}>
            {mo.m > 0 && <line x1={mo.boundaryX} x2={mo.boundaryX} y1={g.bottomY + 1} y2={g.bottomY + 5} stroke="var(--chart-axis)" strokeWidth={1} />}
            {mo.show && (
              <text x={mo.midX} y={g.bottomY + 18} textAnchor="middle" {...textProps}>
                {mo.text}
              </text>
            )}
          </g>
        ))}

        {g.series.map((s) => (
          <path
            key={s.year}
            d={s.d}
            fill="none"
            stroke={s.highlight ? color : NEUTRAL}
            strokeWidth={s.highlight ? 2 : 1.5}
            strokeOpacity={s.opacity}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {g.endLabels.map((e) => (
          <g key={`e${e.year}`}>
            {Math.abs(e.ly - e.py) > 4 && (
              <line x1={e.px + 2} y1={e.py} x2={e.lx - 2} y2={e.ly} stroke="var(--line-strong)" strokeWidth={1} />
            )}
            {e.highlight && <circle cx={e.px} cy={e.py} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />}
            <text
              x={e.lx}
              y={e.ly}
              dy="0.32em"
              fontSize={11}
              fontWeight={e.highlight ? 700 : 500}
              fill={e.highlight ? 'var(--ink)' : 'var(--muted)'}
              className="num"
              stroke="var(--surface)"
              strokeWidth={3}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {e.year}
            </text>
          </g>
        ))}
      </g>
    );
  }, [g, color, valueLabel]);

  const hw = hover ? clamp(hover.w, 1, WEEKS_PER_YEAR) : null;
  const rows = [...years].sort((a, b) => Number(b.highlight) - Number(a.highlight) || b.year - a.year);
  const refInfo = hw !== null ? (rows.map((s) => s.info[hw - 1]).find((i) => i !== null) ?? null) : null;

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={() => setHover(null)}
      className="w-full"
    >
      {legendItems.length > 1 && <ChartLegend items={legendItems} className="mb-2" />}
      <div
        className="relative select-none"
        style={{ height, touchAction: 'pan-y' }}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') setHover(null);
        }}
      >
        <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
          {staticLayer}
          {hw !== null && (
            <g>
              <line x1={g.x(hw)} x2={g.x(hw)} y1={g.top} y2={g.bottomY} stroke="var(--ink)" strokeWidth={1} opacity={0.3} />
              {g.series.map((s) => {
                const v = s.values[hw - 1];
                if (v === null) return null;
                return s.highlight ? (
                  <circle key={s.year} cx={g.x(hw)} cy={g.y(v)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
                ) : (
                  <circle key={s.year} cx={g.x(hw)} cy={g.y(v)} r={3.5} fill="var(--muted)" stroke="var(--surface)" strokeWidth={1.5} />
                );
              })}
            </g>
          )}
        </svg>

        {hover && hw !== null && (
          <ChartTooltip x={g.x(hw)} y={hover.y ?? g.top + 28} boundsWidth={width} boundsHeight={height}>
            <TooltipHeader title={`Minggu ke-${fmtInt(hw)}`} subtitle={refInfo ? fmtWeekRange(refInfo) : undefined} />
            {rows.map((s) => {
              const v = s.values[hw - 1];
              return (
                <TooltipRow
                  key={s.year}
                  label={String(s.year)}
                  value={v === null ? '–' : `${fmtValue(v)} ${unit}`}
                  swatch={{ kind: 'line', color: s.highlight ? color : NEUTRAL, opacity: s.opacity }}
                />
              );
            })}
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}
