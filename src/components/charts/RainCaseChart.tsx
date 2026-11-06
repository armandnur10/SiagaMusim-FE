'use client';

import { useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { area, line } from 'd3-shape';
import { DISEASES, RAIN } from '@/lib/config';
import { fmtDec, fmtInt, fmtRain, fmtWeekLong, fmtWeekRange } from '@/lib/format';
import type { DiseaseId, ForecastPoint, WeekInfo } from '@/types/ews';
import { ChartLegend, type LegendItem } from './ChartLegend';
import { ChartTooltip, TooltipHeader, TooltipNote, TooltipRow } from './ChartTooltip';
import {
  addDays,
  at,
  atOrNull,
  barGeometry,
  barPath,
  clamp,
  contiguousRuns,
  estTextWidth,
  isNum,
  monthTicks,
  niceAxis,
  safeMax,
  thinTicks,
  weekFromStart,
  type LinearAxis,
} from './chartUtils';
import { useElementWidth, useOutsideDismiss } from './useElementWidth';

export interface RainCaseChartProps {
  /** Seluruh minggu dataset (sejajar indeks dengan larik di bawah). */
  weeks: WeekInfo[];
  /** Curah hujan per minggu (mm). */
  rain: number[];
  /** Kasus baru per minggu. */
  cases: number[];
  disease: DiseaseId;
  /** Indeks minggu yang ditampilkan (inklusif). */
  range: { from: number; to: number };
  /** Kasus harapan historis per minggu (sejajar indeks). */
  expected?: number[];
  /** Ambang waspada per minggu (sejajar indeks). */
  threshold?: number[];
  /** Proyeksi 1..4 minggu SETELAH range.to; hanya digambar bila diberikan. */
  forecast?: ForecastPoint[];
  /** Minggu yang disorot (garis penanda + titik tebal). */
  selectedWeek?: number;
  /** Klik/ketuk/Enter pada satu minggu teramati. */
  onSelectWeek?: (weekIndex: number) => void;
  /** Tampilkan jendela jeda hujan -> kasus. Default true. */
  showLagWindow?: boolean;
  /** Tinggi total SVG (kedua panel + sumbu waktu) dalam px. Default 360 (220 bila compact). Legenda berada di atasnya. */
  height?: number;
  /** Padding lebih kecil, tik lebih sedikit, tanpa legenda (untuk kartu). */
  compact?: boolean;
  ariaLabel?: string;
}

const RAIN_LABEL = 'Curah hujan (mm/minggu)';
const CASES_LABEL = 'Kasus baru/minggu';
const RAIN_EXTREME_FILL = RAIN.ramp[5];
const RAIN_EXTREME_MARK = RAIN.ramp[6];
const MAX_FORECAST = 12;

interface Model {
  from: number;
  to: number;
  /** Jumlah minggu teramati yang ditampilkan. */
  n: number;
  /** Jumlah slot minggu proyeksi. */
  f: number;
  total: number;
  dWeeks: WeekInfo[];
  rainV: number[];
  casesV: number[];
  expV: (number | null)[];
  thrV: (number | null)[];
  fc: (ForecastPoint | null)[];
  exceed: boolean[];
  hasExpected: boolean;
  hasThreshold: boolean;
  anyExtreme: boolean;
  anyExceed: boolean;
  rainAxis: LinearAxis;
  casesAxis: LinearAxis;
}

function buildModel(p: RainCaseChartProps, compact: boolean): Model | null {
  const len = p.weeks.length;
  if (len === 0) return null;
  const a = clamp(Math.round(isNum(p.range.from) ? p.range.from : 0), 0, len - 1);
  const b = clamp(Math.round(isNum(p.range.to) ? p.range.to : len - 1), 0, len - 1);
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  const n = to - from + 1;

  const valid = (p.forecast ?? []).filter(
    (pt) => isNum(pt.horizon) && pt.horizon >= 1 && pt.horizon <= MAX_FORECAST && isNum(pt.expected),
  );
  const f = valid.reduce((m, pt) => Math.max(m, Math.round(pt.horizon)), 0);
  const fc: (ForecastPoint | null)[] = Array.from({ length: f }, () => null);
  for (const pt of valid) fc[Math.round(pt.horizon) - 1] = pt;

  const dWeeks: WeekInfo[] = p.weeks.slice(from, to + 1);
  const lastDate = p.weeks[to].date;
  for (let h = 1; h <= f; h++) {
    const pt = fc[h - 1];
    dWeeks.push(pt ? weekFromStart(pt.date, to + h, pt.isoWeek) : weekFromStart(addDays(lastDate, 7 * h), to + h));
  }

  const rainV: number[] = [];
  const casesV: number[] = [];
  const expV: (number | null)[] = [];
  const thrV: (number | null)[] = [];
  const exceed: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.max(0, at(p.rain, from + i));
    const c = Math.max(0, at(p.cases, from + i));
    const e = atOrNull(p.expected, from + i);
    const t = atOrNull(p.threshold, from + i);
    rainV.push(r);
    casesV.push(c);
    expV.push(e === null ? null : Math.max(0, e));
    thrV.push(t === null ? null : Math.max(0, t));
    exceed.push(t !== null && c > t);
  }
  const hasExpected = expV.some((v) => v !== null);
  const hasThreshold = thrV.some((v) => v !== null);
  for (let h = 1; h <= f; h++) {
    const pt = fc[h - 1];
    expV.push(hasExpected && pt && isNum(pt.baseline) ? Math.max(0, pt.baseline) : null);
    thrV.push(hasThreshold && pt && isNum(pt.threshold) ? Math.max(0, pt.threshold) : null);
  }

  const fcHigh = fc.map((pt) => (pt ? Math.max(pt.expected, isNum(pt.high) ? pt.high : 0) : 0));
  const casesMax = Math.max(safeMax(casesV), safeMax(expV), safeMax(thrV), safeMax(fcHigh));
  const rainMax = safeMax(rainV);

  return {
    from,
    to,
    n,
    f,
    total: n + f,
    dWeeks,
    rainV,
    casesV,
    expV,
    thrV,
    fc,
    exceed,
    hasExpected,
    hasThreshold,
    anyExtreme: rainV.some((v) => v >= RAIN.extremeWeekly),
    anyExceed: exceed.some(Boolean),
    rainAxis: niceAxis(0, rainMax, 2, false, 50),
    casesAxis: niceAxis(0, casesMax, compact ? 3 : 4, true, 4),
  };
}

interface Geometry {
  width: number;
  svgH: number;
  left: number;
  right: number;
  plotW: number;
  band: number;
  barW: number;
  rainTop: number;
  rainBottom: number;
  casesTop: number;
  casesBottom: number;
  rainLabelY: number;
  casesLabelY: number;
  connectorY: number;
  /** Keterangan jendela jeda (overlay HTML): rata kanan sebaris judul panel, atau baris sendiri rata kiri. */
  caption: { top: number; align: 'left' | 'right' } | null;
  fontSize: number;
}

function buildGeometry(
  m: Model,
  width: number,
  height: number,
  compact: boolean,
  showLag: boolean,
  captionText: string,
): Geometry {
  const fontSize = compact ? 10.5 : 11;
  const labelRow = 16;
  const maxChars = Math.max(
    ...m.casesAxis.ticks.map((t) => fmtInt(t).length),
    ...m.rainAxis.ticks.map((t) => fmtInt(t).length),
  );
  const left = Math.max(compact ? 24 : 28, Math.ceil(maxChars * 6.4) + 10);
  const right = compact ? 6 : 12;
  const plotW = Math.max(10, width - left - right);
  const band = plotW / m.total;

  const captionW = estTextWidth(captionText, fontSize) + 18;
  const sideBySide = width - right >= estTextWidth(RAIN_LABEL, fontSize) + captionW + 20;
  const captionRow = showLag && !sideBySide && !compact;

  // +8: tik teratas tiap panel menjorok ~6px ke atas garisnya, jadi judul panel perlu jarak.
  const rainTop = labelRow + (captionRow ? labelRow : 0) + 8;
  const mid = 10 + labelRow + 8;
  const xBand = 24;
  const avail = Math.max(90, height - rainTop - mid - xBand);
  const rainH = Math.max(28, Math.round(avail * 0.3));
  const casesH = Math.max(44, avail - rainH);
  const rainBottom = rainTop + rainH;
  const casesTop = rainBottom + mid;
  const casesBottom = casesTop + casesH;

  let caption: Geometry['caption'] = null;
  if (showLag && sideBySide) caption = { top: 0, align: 'right' };
  else if (captionRow) caption = { top: labelRow, align: 'left' };

  return {
    width,
    svgH: casesBottom + xBand,
    left,
    right,
    plotW,
    band,
    barW: barGeometry(band).width,
    rainTop,
    rainBottom,
    casesTop,
    casesBottom,
    rainLabelY: 11,
    casesLabelY: casesTop - 12,
    connectorY: rainBottom + 5,
    caption,
    fontSize,
  };
}

interface HoverState {
  i: number;
  /** Posisi y pointer (null untuk navigasi papan ketik). */
  y: number | null;
}

/**
 * Grafik utama: dua panel bertumpuk dengan SATU sumbu waktu - batang curah hujan (atas) dan
 * garis kasus (bawah). Tidak pernah memakai sumbu-y ganda. Menyorot "jendela jeda":
 * hujan mana yang secara epidemiologis memicu kasus pada minggu aktif.
 */
export function RainCaseChart(props: RainCaseChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const compact = props.compact ?? false;
  const height = Math.max(160, props.height ?? (compact ? 220 : 360));
  const hasData = props.weeks.length > 0;

  return (
    <div ref={ref} className="w-full min-w-0">
      {!hasData ? (
        <div
          role="img"
          aria-label={props.ariaLabel ?? 'Grafik curah hujan dan kasus: belum ada data'}
          className="flex items-center justify-center text-[13px] text-muted"
          style={{ height }}
        >
          Belum ada data untuk ditampilkan
        </div>
      ) : width > 0 ? (
        <RainCasePlot {...props} compact={compact} height={height} width={width} />
      ) : (
        <div style={{ height }} aria-hidden="true" />
      )}
    </div>
  );
}

type PlotProps = RainCaseChartProps & { width: number; height: number; compact: boolean };

function RainCasePlot(props: PlotProps) {
  const { weeks, rain, cases, disease, range, expected, threshold, forecast, selectedWeek, onSelectWeek, width, height, compact, ariaLabel } =
    props;
  const showLag = props.showLagWindow ?? true;
  const cfg = DISEASES[disease];
  const captionText = `Hujan pemicu: ${cfg.lagLabel} sebelumnya`;
  const rangeFrom = range.from;
  const rangeTo = range.to;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  useOutsideDismiss(rootRef, hover !== null, () => setHover(null));

  const model = useMemo(
    () => buildModel({ weeks, rain, cases, disease, range: { from: rangeFrom, to: rangeTo }, expected, threshold, forecast }, compact),
    [weeks, rain, cases, disease, rangeFrom, rangeTo, expected, threshold, forecast, compact],
  );

  const geo = useMemo(
    () => (model ? buildGeometry(model, width, height, compact, showLag, captionText) : null),
    [model, width, height, compact, showLag, captionText],
  );

  // ---- Skala & path statis -------------------------------------------------
  const paths = useMemo(() => {
    if (!model || !geo) return null;
    const { n, f, total } = model;
    const xc = (i: number) => geo.left + (i + 0.5) * geo.band;
    const rainH = geo.rainBottom - geo.rainTop;
    const casesH = geo.casesBottom - geo.casesTop;
    const yRain = (v: number) => geo.rainBottom - (clamp(v, 0, model.rainAxis.max) / model.rainAxis.max) * rainH;
    const yCases = (v: number) => geo.casesBottom - (clamp(v, 0, model.casesAxis.max) / model.casesAxis.max) * casesH;

    const obs = Array.from({ length: n }, (_, i) => i);
    const all = Array.from({ length: total }, (_, i) => i);

    const casesLine =
      line<number>()
        .x((i) => xc(i))
        .y((i) => yCases(model.casesV[i]))(obs) ?? '';
    const casesArea =
      area<number>()
        .x((i) => xc(i))
        .y0(geo.casesBottom)
        .y1((i) => yCases(model.casesV[i]))(obs) ?? '';

    const hasBand = model.hasExpected && model.hasThreshold;
    const bandArea = hasBand
      ? (area<number>()
          .defined((i) => model.expV[i] !== null && model.thrV[i] !== null)
          .x((i) => xc(i))
          .y0((i) => yCases(model.expV[i] ?? 0))
          .y1((i) => yCases(model.thrV[i] ?? 0))(all) ?? '')
      : '';
    const expLine = model.hasExpected
      ? (line<number>()
          .defined((i) => model.expV[i] !== null)
          .x((i) => xc(i))
          .y((i) => yCases(model.expV[i] ?? 0))(all) ?? '')
      : '';
    const thrLine = model.hasThreshold
      ? (line<number>()
          .defined((i) => model.thrV[i] !== null)
          .x((i) => xc(i))
          .y((i) => yCases(model.thrV[i] ?? 0))(all) ?? '')
      : '';

    // Proyeksi: berangkat dari titik teramati terakhir, lalu mengikuti nilai harapan.
    interface FcNode {
      i: number;
      mid: number;
      low: number;
      high: number;
    }
    const lastObs = model.casesV[n - 1];
    const fcNodes: FcNode[] = f > 0 ? [{ i: n - 1, mid: lastObs, low: lastObs, high: lastObs }] : [];
    model.fc.forEach((pt, k) => {
      if (!pt) return;
      const mid = Math.max(0, pt.expected);
      fcNodes.push({
        i: n + k,
        mid,
        low: clamp(isNum(pt.low) ? pt.low : mid, 0, mid),
        high: Math.max(mid, isNum(pt.high) ? pt.high : mid),
      });
    });
    const fcLine =
      fcNodes.length > 1
        ? (line<FcNode>()
            .x((d) => xc(d.i))
            .y((d) => yCases(d.mid))(fcNodes) ?? '')
        : '';
    const fcBand =
      fcNodes.length > 1
        ? (area<FcNode>()
            .x((d) => xc(d.i))
            .y0((d) => yCases(d.low))
            .y1((d) => yCases(d.high))(fcNodes) ?? '')
        : '';

    const bars = model.rainV.map((v, i) => {
      const yTop = yRain(v);
      return {
        i,
        d: barPath(xc(i) - geo.barW / 2, geo.barW, geo.rainBottom, yTop, geo.barW >= 5 ? 2.5 : geo.barW >= 3 ? 1 : 0),
        extreme: v >= RAIN.extremeWeekly,
        yTop,
      };
    });

    const ticks = monthTicks(model.dWeeks, xc, compact ? 54 : 48);

    return { xc, yRain, yCases, casesLine, casesArea, hasBand, bandArea, expLine, thrLine, fcLine, fcBand, bars, ticks };
  }, [model, geo, compact]);

  // ---- Minggu aktif & jendela jeda ----------------------------------------
  const selIdx =
    model && isNum(selectedWeek) && selectedWeek >= model.from && selectedWeek <= model.to ? selectedWeek - model.from : null;
  const hoverIdx = model && hover ? clamp(hover.i, 0, model.total - 1) : null;
  const activeIdx = hoverIdx ?? selIdx;

  const lagKey = useMemo(() => {
    if (!model || !showLag || activeIdx === null) return '';
    return cfg.lags
      .map((l) => activeIdx - l)
      .filter((j) => j >= 0 && j < model.n)
      .join(',');
  }, [model, showLag, activeIdx, cfg.lags]);

  const lagRuns = useMemo(() => contiguousRuns(lagKey === '' ? [] : lagKey.split(',').map(Number)), [lagKey]);

  const barsLayer = useMemo(() => {
    if (!paths || !geo) return null;
    const lagSet = new Set<number>();
    for (const [s, e] of lagRuns) for (let j = s; j <= e; j++) lagSet.add(j);
    const dim = lagSet.size > 0;
    return (
      <g>
        {paths.bars.map((b) =>
          b.d ? (
            <path
              key={b.i}
              d={b.d}
              fill={b.extreme ? RAIN_EXTREME_FILL : RAIN.color}
              opacity={dim && !lagSet.has(b.i) ? 0.38 : 1}
            />
          ) : null,
        )}
        {geo.band >= 5 &&
          paths.bars.map((b) =>
            b.extreme ? (
              <circle
                key={`x${b.i}`}
                cx={paths.xc(b.i)}
                cy={b.yTop - 4}
                r={1.75}
                fill={RAIN_EXTREME_MARK}
                opacity={dim && !lagSet.has(b.i) ? 0.38 : 1}
              />
            ) : null,
          )}
      </g>
    );
  }, [paths, geo, lagRuns]);

  // ---- Lapisan statis: kisi, sumbu, seri -----------------------------------
  // "Sekarang" hanya benar bila deret berakhir di minggu terakhir data; saat menengok minggu lampau pakai label netral.
  const nowLabel = props.range.to >= props.weeks.length - 1 ? 'Sekarang' : 'Minggu terpilih';
  const chromeLayer = useMemo(() => {
    if (!model || !geo || !paths) return null;
    const x0 = geo.left;
    const x1 = geo.left + geo.plotW;
    const textProps = { fontSize: geo.fontSize, fill: 'var(--muted)' } as const;
    const futureX = geo.left + model.n * geo.band;
    const nowLabelFits = futureX - 4 - estTextWidth(nowLabel, geo.fontSize) > estTextWidth(CASES_LABEL, geo.fontSize) + 12;
    return (
      <g>
        {/* Wilayah masa depan (proyeksi) */}
        {model.f > 0 && (
          <>
            <rect x={futureX} y={geo.rainTop} width={Math.max(0, x1 - futureX)} height={geo.rainBottom - geo.rainTop} fill="var(--sunken)" opacity={0.55} />
            <rect x={futureX} y={geo.casesTop} width={Math.max(0, x1 - futureX)} height={geo.casesBottom - geo.casesTop} fill="var(--sunken)" opacity={0.55} />
          </>
        )}

        {/* Kisi + tik sumbu-y: hujan */}
        {thinTicks(model.rainAxis.ticks, geo.rainBottom - geo.rainTop, 15).map((t) => {
          const y = Math.round(paths.yRain(t)) + 0.5;
          return (
            <g key={`r${t}`}>
              {t > 0 && <line x1={x0} x2={x1} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />}
              <text x={x0 - 6} y={y} dy="0.32em" textAnchor="end" className="num" {...textProps}>
                {fmtInt(t)}
              </text>
            </g>
          );
        })}
        {/* Kisi + tik sumbu-y: kasus */}
        {thinTicks(model.casesAxis.ticks, geo.casesBottom - geo.casesTop, 18).map((t) => {
          const y = Math.round(paths.yCases(t)) + 0.5;
          return (
            <g key={`c${t}`}>
              {t > 0 && <line x1={x0} x2={x1} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />}
              <text x={x0 - 6} y={y} dy="0.32em" textAnchor="end" className="num" {...textProps}>
                {fmtInt(t)}
              </text>
            </g>
          );
        })}

        {/* Judul panel */}
        <text x={0} y={geo.rainLabelY} fontSize={geo.fontSize} fill="var(--ink-2)" fontWeight={600}>
          {RAIN_LABEL}
        </text>
        <text x={0} y={geo.casesLabelY} fontSize={geo.fontSize} fill="var(--ink-2)" fontWeight={600}>
          {CASES_LABEL}
        </text>

        {/* Pembatas "sekarang" */}
        {model.f > 0 && (
          <>
            <line x1={futureX} x2={futureX} y1={geo.rainTop} y2={geo.casesBottom} stroke="var(--chart-axis)" strokeWidth={1} />
            {nowLabelFits && (
              <text x={futureX - 4} y={geo.casesLabelY} textAnchor="end" {...textProps}>
                {nowLabel}
              </text>
            )}
          </>
        )}

        {/* Garis dasar */}
        <line x1={x0} x2={x1} y1={geo.rainBottom + 0.5} y2={geo.rainBottom + 0.5} stroke="var(--chart-axis)" strokeWidth={1} />
        <line x1={x0} x2={x1} y1={geo.casesBottom + 0.5} y2={geo.casesBottom + 0.5} stroke="var(--chart-axis)" strokeWidth={1} />

        {/* Sumbu waktu bersama */}
        {paths.ticks.map((t) => {
          const anchor = t.x > geo.width - 24 ? 'end' : t.x < 20 ? 'start' : 'middle';
          return (
            <g key={`t${t.i}`}>
              <line x1={t.x} x2={t.x} y1={geo.casesBottom + 1} y2={geo.casesBottom + 5} stroke="var(--chart-axis)" strokeWidth={1} />
              <text x={t.x} y={geo.casesBottom + 18} textAnchor={anchor} className="num" {...textProps}>
                {t.label}
              </text>
            </g>
          );
        })}
      </g>
    );
  }, [model, geo, paths, nowLabel]);

  const seriesLayer = useMemo(() => {
    if (!model || !geo || !paths) return null;
    const dotR = geo.band >= 6 ? 3 : 2;
    return (
      <g>
        {paths.bandArea && <path d={paths.bandArea} fill="var(--muted)" opacity={0.1} />}
        {paths.expLine && <path d={paths.expLine} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} strokeLinejoin="round" />}
        {paths.thrLine && (
          <path d={paths.thrLine} fill="none" stroke="var(--muted)" strokeWidth={1.25} strokeDasharray="4 3" strokeLinejoin="round" />
        )}
        {paths.fcBand && <path d={paths.fcBand} fill={cfg.color} opacity={0.14} />}
        {!paths.hasBand && model.n > 1 && <path d={paths.casesArea} fill={cfg.color} opacity={0.08} />}
        {paths.fcLine && (
          <path d={paths.fcLine} fill="none" stroke={cfg.color} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
        )}
        <path d={paths.casesLine} fill="none" stroke={cfg.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {model.n === 1 && <circle cx={paths.xc(0)} cy={paths.yCases(model.casesV[0])} r={4} fill={cfg.color} stroke="var(--surface)" strokeWidth={2} />}
        {model.exceed.map((ex, i) =>
          ex ? (
            <circle
              key={i}
              cx={paths.xc(i)}
              cy={paths.yCases(model.casesV[i])}
              r={dotR}
              fill={cfg.color}
              stroke="var(--surface)"
              strokeWidth={geo.band >= 6 ? 1.5 : 0}
            />
          ) : null,
        )}
      </g>
    );
  }, [model, geo, paths, cfg.color]);

  const legendItems = useMemo<LegendItem[]>(() => {
    if (!model) return [];
    const items: LegendItem[] = [{ id: 'cases', label: `Kasus ${cfg.short}`, kind: 'line', color: cfg.color }];
    if (model.hasExpected) items.push({ id: 'exp', label: 'Rata-rata historis', kind: 'line', color: 'var(--line-strong)' });
    if (model.hasThreshold) items.push({ id: 'thr', label: 'Ambang (rata-rata + 2 SB)', kind: 'dash', color: 'var(--muted)' });
    if (model.anyExceed) items.push({ id: 'exc', label: 'Di atas ambang', kind: 'dot', color: cfg.color });
    if (model.f > 0) items.push({ id: 'fc', label: 'Proyeksi', kind: 'band', color: cfg.color });
    if (model.anyExtreme)
      items.push({ id: 'ext', label: `Hujan ekstrem (≥ ${fmtInt(RAIN.extremeWeekly)} mm)`, kind: 'rect', color: RAIN_EXTREME_FILL });
    return items;
  }, [model, cfg.short, cfg.color]);

  if (!model || !geo || !paths) return <div style={{ height }} aria-hidden="true" />;

  const { n, total } = model;

  // ---- Interaksi -----------------------------------------------------------
  const indexAt = (clientX: number, el: HTMLElement): number => {
    const rect = el.getBoundingClientRect();
    return clamp(Math.floor((clientX - rect.left - geo.left) / geo.band), 0, total - 1);
  };
  const track = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = indexAt(e.clientX, e.currentTarget);
    const y = Math.round((e.clientY - rect.top) / 4) * 4;
    setHover((prev) => (prev && prev.i === i && prev.y === y ? prev : { i, y }));
  };
  const onPointerLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') setHover(null);
  };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onSelectWeek) return;
    // Di layar sentuh, ketukan dipakai untuk membaca tooltip; jangan sekaligus mengganti minggu.
    if ((e.nativeEvent as unknown as { pointerType?: string }).pointerType === 'touch') return;
    const i = indexAt(e.clientX, e.currentTarget);
    if (i < n) onSelectWeek(model.from + i);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = hoverIdx ?? selIdx ?? n - 1;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = cur - 1;
    else if (e.key === 'ArrowRight') next = cur + 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = total - 1;
    else if (e.key === 'Escape') {
      setHover(null);
      return;
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (onSelectWeek && hoverIdx !== null && hoverIdx < n) {
        e.preventDefault();
        onSelectWeek(model.from + hoverIdx);
      }
      return;
    }
    if (next !== null) {
      e.preventDefault();
      setHover({ i: clamp(next, 0, total - 1), y: null });
    }
  };
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) {
      setHover((prev) => prev ?? { i: selIdx ?? n - 1, y: null });
    }
  };

  // ---- Lapisan aktif -------------------------------------------------------
  const activeX = activeIdx !== null ? paths.xc(activeIdx) : null;
  const activeY = (i: number): number | null => {
    if (i < n) return paths.yCases(model.casesV[i]);
    const pt = model.fc[i - n];
    return pt ? paths.yCases(Math.max(0, pt.expected)) : null;
  };
  const selY = selIdx !== null ? activeY(selIdx) : null;
  const hovY = hoverIdx !== null ? activeY(hoverIdx) : null;

  const first = model.dWeeks[0];
  const lastObsWeek = model.dWeeks[n - 1];
  const label =
    ariaLabel ??
    `Grafik curah hujan mingguan dan kasus baru ${cfg.name}, ${fmtWeekLong(first)} sampai ${fmtWeekLong(lastObsWeek)}. ` +
      `Minggu terakhir: ${fmtInt(model.casesV[n - 1])} kasus, curah hujan ${fmtRain(model.rainV[n - 1])}.` +
      (model.f > 0 ? ` Termasuk proyeksi ${model.f} minggu ke depan.` : '');

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
      {!compact && legendItems.length > 1 && <ChartLegend items={legendItems} className="mb-2" />}
      <div
        className="relative select-none"
        style={{ height: geo.svgH, touchAction: 'pan-y', cursor: onSelectWeek ? 'pointer' : 'default' }}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
      >
        <svg width={width} height={geo.svgH} aria-hidden="true" className="block overflow-visible">
          {chromeLayer}

          {/* Jendela jeda: latar di panel hujan */}
          {lagRuns.map(([s, e]) => (
            <rect
              key={`lag${s}`}
              x={geo.left + s * geo.band}
              y={geo.rainTop}
              width={(e - s + 1) * geo.band}
              height={geo.rainBottom - geo.rainTop}
              rx={3}
              fill={cfg.color}
              opacity={0.14}
            />
          ))}

          {barsLayer}

          {/* Penghubung: hujan pemicu -> minggu aktif */}
          {lagRuns.length > 0 && activeX !== null && (
            <g>
              <line
                x1={Math.min(geo.left + lagRuns[0][0] * geo.band, activeX)}
                x2={Math.max(geo.left + (lagRuns[lagRuns.length - 1][1] + 1) * geo.band, activeX)}
                y1={geo.connectorY}
                y2={geo.connectorY}
                stroke={cfg.color}
                strokeWidth={1}
                opacity={0.6}
              />
              {lagRuns.map(([s, e]) => (
                <line
                  key={`br${s}`}
                  x1={geo.left + s * geo.band}
                  x2={geo.left + (e + 1) * geo.band}
                  y1={geo.connectorY}
                  y2={geo.connectorY}
                  stroke={cfg.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              ))}
            </g>
          )}

          {seriesLayer}

          {/* Minggu terpilih */}
          {selIdx !== null && (
            <g>
              <line
                x1={paths.xc(selIdx)}
                x2={paths.xc(selIdx)}
                y1={geo.rainTop}
                y2={geo.casesBottom}
                stroke="var(--ink)"
                strokeWidth={1}
                opacity={0.5}
              />
              <path
                d={`M${paths.xc(selIdx) - 4},${geo.rainTop - 5}h8l-4,5z`}
                fill="var(--ink)"
              />
              {selY !== null && (
                <circle cx={paths.xc(selIdx)} cy={selY} r={4.5} fill={cfg.color} stroke="var(--surface)" strokeWidth={2} />
              )}
            </g>
          )}

          {/* Crosshair */}
          {hoverIdx !== null && hoverIdx !== selIdx && (
            <g>
              <line
                x1={paths.xc(hoverIdx)}
                x2={paths.xc(hoverIdx)}
                y1={geo.rainTop}
                y2={geo.casesBottom}
                stroke="var(--ink)"
                strokeWidth={1}
                opacity={0.3}
              />
              {hovY !== null && <circle cx={paths.xc(hoverIdx)} cy={hovY} r={4} fill={cfg.color} stroke="var(--surface)" strokeWidth={2} />}
            </g>
          )}
        </svg>

        {geo.caption && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute flex items-center gap-1.5 whitespace-nowrap text-muted"
            style={{
              top: geo.caption.top,
              height: 16,
              fontSize: geo.fontSize,
              lineHeight: '16px',
              ...(geo.caption.align === 'right' ? { right: geo.right } : { left: 0 }),
            }}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: cfg.color, opacity: 0.22 }} />
            {captionText}
          </div>
        )}

        {hover && hoverIdx !== null && (
          <ChartTooltip
            x={paths.xc(hoverIdx)}
            y={hover.y ?? geo.casesTop + 28}
            boundsWidth={width}
            boundsHeight={geo.svgH}
          >
            <TooltipBody model={model} index={hoverIdx} disease={disease} />
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}

function TooltipBody({ model, index, disease }: { model: Model; index: number; disease: DiseaseId }) {
  const cfg = DISEASES[disease];
  const week = model.dWeeks[index];
  const exp = model.expV[index];
  const thr = model.thrV[index];

  if (index >= model.n) {
    const pt = model.fc[index - model.n];
    return (
      <>
        <TooltipHeader title={fmtWeekLong(week)} subtitle={fmtWeekRange(week)} tag="Proyeksi" />
        {pt ? (
          <>
            <TooltipRow label={`Proyeksi ${cfg.short}`} value={`${fmtDec(pt.expected, 1)} kasus`} swatch={{ kind: 'dash', color: cfg.color }} />
            {isNum(pt.low) && isNum(pt.high) && (
              <TooltipRow
                label="Rentang"
                value={`${fmtDec(pt.low, 1)} – ${fmtDec(pt.high, 1)} kasus`}
                swatch={{ kind: 'rect', color: cfg.color, opacity: 0.25 }}
              />
            )}
            {exp !== null && (
              <TooltipRow label="Rata-rata historis" value={`${fmtDec(exp, 1)} kasus`} swatch={{ kind: 'line', color: 'var(--line-strong)' }} />
            )}
            {isNum(pt.threshold) && (
              <TooltipRow label="Ambang" value={`${fmtDec(pt.threshold, 1)} kasus`} swatch={{ kind: 'dash', color: 'var(--muted)' }} />
            )}
            {isNum(pt.threshold) && pt.expected > pt.threshold && <TooltipNote dotColor={cfg.color}>Diproyeksikan di atas ambang</TooltipNote>}
          </>
        ) : (
          <div className="text-ink-2">Proyeksi tidak tersedia</div>
        )}
      </>
    );
  }

  const rainMm = model.rainV[index];
  const extreme = rainMm >= RAIN.extremeWeekly;
  return (
    <>
      <TooltipHeader title={fmtWeekLong(week)} subtitle={fmtWeekRange(week)} />
      <TooltipRow
        label={extreme ? 'Curah hujan (ekstrem)' : 'Curah hujan'}
        value={fmtRain(rainMm)}
        swatch={{ kind: 'rect', color: extreme ? RAIN_EXTREME_FILL : RAIN.color }}
      />
      <TooltipRow label={`Kasus ${cfg.short}`} value={`${fmtInt(model.casesV[index])} kasus`} swatch={{ kind: 'line', color: cfg.color }} />
      {exp !== null && (
        <TooltipRow label="Rata-rata historis" value={`${fmtDec(exp, 1)} kasus`} swatch={{ kind: 'line', color: 'var(--line-strong)' }} />
      )}
      {thr !== null && <TooltipRow label="Ambang" value={`${fmtDec(thr, 1)} kasus`} swatch={{ kind: 'dash', color: 'var(--muted)' }} />}
      {model.exceed[index] && <TooltipNote dotColor={cfg.color}>Di atas ambang</TooltipNote>}
    </>
  );
}
