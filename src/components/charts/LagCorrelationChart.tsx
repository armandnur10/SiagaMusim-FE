'use client';

import { useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { DISEASES } from '@/lib/config';
import { fmtDec, fmtInt } from '@/lib/format';
import type { DiseaseId, LagCorrelationPoint } from '@/types/ews';
import { ChartTooltip } from './ChartTooltip';
import { barGeometry, barPath, clamp, contiguousRuns, estTextWidth, isNum, niceAxis } from './chartUtils';
import { useElementWidth, useOutsideDismiss } from './useElementWidth';

export interface LagCorrelationChartProps {
  /** Korelasi Pearson per jeda (hujan mendahului kasus). */
  points: LagCorrelationPoint[];
  /** Jeda dengan korelasi terkuat - disorot dengan warna penyakit dan diberi label langsung. */
  bestLag: number;
  disease: DiseaseId;
  /** Tinggi total px. Default 260. */
  height?: number;
  ariaLabel?: string;
}

const Y_TITLE = 'Korelasi Pearson (r)';
const X_TITLE = 'Jeda (minggu) — hujan mendahului kasus';
const X_TITLE_SHORT = 'Jeda (minggu)';
const WINDOW_CAPTION = 'Jendela yang dipakai mesin risiko';
const fmtR = (r: number): string => fmtDec(r, 2);

/** Diagram batang korelasi hujan -> kasus menurut jeda. Satu seri netral, satu batang disorot. */
export function LagCorrelationChart(props: LagCorrelationChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const height = Math.max(180, props.height ?? 260);
  const clean = useMemo(
    () => props.points.filter((p) => isNum(p.lag) && isNum(p.r)).sort((a, b) => a.lag - b.lag),
    [props.points],
  );
  const cfg = DISEASES[props.disease];
  const best = clean.find((p) => p.lag === props.bestLag);
  const label =
    props.ariaLabel ??
    (clean.length === 0
      ? `Korelasi curah hujan dengan kasus ${cfg.short} menurut jeda: belum ada data`
      : `Korelasi curah hujan dengan kasus ${cfg.short} menurut jeda ${fmtInt(clean[0].lag)} sampai ${fmtInt(clean[clean.length - 1].lag)} minggu.` +
        (best ? ` Korelasi terkuat pada jeda ${fmtInt(best.lag)} minggu, r = ${fmtR(best.r)}.` : '') +
        ` Mesin risiko memakai jeda ${cfg.lagLabel}.`);

  return (
    <div ref={ref} className="w-full min-w-0">
      {clean.length === 0 ? (
        <div role="img" aria-label={label} className="flex items-center justify-center text-[13px] text-muted" style={{ height }}>
          Belum ada data untuk ditampilkan
        </div>
      ) : width > 0 ? (
        <LagPlot points={clean} bestLag={props.bestLag} disease={props.disease} width={width} height={height} label={label} />
      ) : (
        <div style={{ height }} aria-hidden="true" />
      )}
    </div>
  );
}

interface LagPlotProps {
  points: LagCorrelationPoint[];
  bestLag: number;
  disease: DiseaseId;
  width: number;
  height: number;
  label: string;
}

function LagPlot({ points, bestLag, disease, width, height, label }: LagPlotProps) {
  const cfg = DISEASES[disease];
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<number | null>(null);
  useOutsideDismiss(rootRef, active !== null, () => setActive(null));

  const g = useMemo(() => {
    const count = points.length;
    let minR = 0;
    let maxR = 0.2;
    for (const p of points) {
      if (p.r < minR) minR = p.r;
      if (p.r > maxR) maxR = p.r;
    }
    const axis = niceAxis(minR, maxR, 4, false, 0.2);
    const decimals = axis.step < 0.1 ? 2 : 1;
    const tickLabels = axis.ticks.map((t) => (t === 0 ? fmtInt(0) : fmtDec(t, decimals)));
    const left = Math.max(30, Math.ceil(Math.max(...tickLabels.map((t) => t.length)) * 6.4) + 10);
    const right = 12;
    const top = 46;
    const bottom = 42;
    const plotW = Math.max(10, width - left - right);
    const plotH = Math.max(40, height - top - bottom);
    const band = plotW / count;
    const barW = barGeometry(band).width;
    const y = (r: number) => top + (1 - (clamp(r, axis.min, axis.max) - axis.min) / (axis.max - axis.min)) * plotH;
    const xc = (i: number) => left + (i + 0.5) * band;

    const windowIdx: number[] = [];
    points.forEach((p, i) => {
      if (cfg.lags.includes(p.lag)) windowIdx.push(i);
    });
    const windows = contiguousRuns(windowIdx);
    let caption: { x: number; text: string } | null = null;
    if (windows.length > 0) {
      const cx = left + ((windows[0][0] + windows[windows.length - 1][1] + 1) / 2) * band;
      const tw = estTextWidth(WINDOW_CAPTION, 11);
      if (tw <= width) caption = { x: clamp(cx, tw / 2, width - tw / 2), text: WINDOW_CAPTION };
    }
    const labelStep = band >= 16 ? 1 : band >= 8 ? 2 : 4;
    const xTitle = estTextWidth(X_TITLE, 11) <= plotW ? X_TITLE : X_TITLE_SHORT;

    return { axis, tickLabels, left, right, top, plotW, plotH, band, barW, y, xc, windows, caption, labelStep, xTitle, bottomY: top + plotH };
  }, [points, width, height, cfg.lags]);

  const count = points.length;
  const indexAt = (e: PointerEvent<HTMLDivElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    return clamp(Math.floor((e.clientX - rect.left - g.left) / g.band), 0, count - 1);
  };
  const track = (e: PointerEvent<HTMLDivElement>) => {
    const i = indexAt(e);
    setActive((prev) => (prev === i ? prev : i));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const bestIdx = points.findIndex((p) => p.lag === bestLag);
    const cur = active ?? (bestIdx >= 0 ? bestIdx : 0);
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = active === null ? cur : cur - 1;
    else if (e.key === 'ArrowRight') next = active === null ? cur : cur + 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else if (e.key === 'Escape') setActive(null);
    if (next !== null) {
      e.preventDefault();
      setActive(clamp(next, 0, count - 1));
    }
  };
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) {
      const bestIdx = points.findIndex((p) => p.lag === bestLag);
      setActive((prev) => prev ?? (bestIdx >= 0 ? bestIdx : 0));
    }
  };

  const zeroY = Math.round(g.y(0)) + 0.5;
  const textProps = { fontSize: 11, fill: 'var(--muted)' } as const;
  const activePoint = active !== null ? points[active] : null;

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={() => setActive(null)}
      className="w-full"
    >
      <div
        className="relative select-none"
        style={{ height, touchAction: 'pan-y' }}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') setActive(null);
        }}
      >
        <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
          {/* Jendela jeda yang dipakai mesin risiko */}
          {g.windows.map(([s, e]) => (
            <rect
              key={`w${s}`}
              x={g.left + s * g.band}
              y={g.top - 10}
              width={(e - s + 1) * g.band}
              height={g.plotH + 10}
              rx={4}
              fill={cfg.color}
              opacity={0.09}
            />
          ))}
          {g.caption && (
            <text x={g.caption.x} y={27} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
              {g.caption.text}
            </text>
          )}

          {/* Kisi & tik sumbu-y */}
          {g.axis.ticks.map((t, k) => {
            const y = Math.round(g.y(t)) + 0.5;
            return (
              <g key={t}>
                {t !== 0 && <line x1={g.left} x2={g.left + g.plotW} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />}
                <text x={g.left - 6} y={y} dy="0.32em" textAnchor="end" className="num" {...textProps}>
                  {g.tickLabels[k]}
                </text>
              </g>
            );
          })}
          <text x={0} y={11} fontSize={11} fill="var(--ink-2)" fontWeight={600}>
            {Y_TITLE}
          </text>

          {/* Batang */}
          {points.map((p, i) => {
            const isBest = p.lag === bestLag;
            const isActive = active === i;
            const d = barPath(g.xc(i) - g.barW / 2, g.barW, g.y(0), g.y(p.r), g.barW >= 6 ? 3 : 1);
            return d ? (
              <path
                key={p.lag}
                d={d}
                fill={isBest ? cfg.color : isActive ? 'var(--muted)' : 'var(--line-strong)'}
                opacity={isBest && isActive ? 0.85 : 1}
              />
            ) : null;
          })}

          {/* Garis dasar nol */}
          <line x1={g.left} x2={g.left + g.plotW} y1={zeroY} y2={zeroY} stroke="var(--chart-axis)" strokeWidth={1} />

          {/* Label langsung pada jeda terkuat */}
          {points.map((p, i) => {
            if (p.lag !== bestLag) return null;
            const text = `r = ${fmtR(p.r)}`;
            const tw = estTextWidth(text, 11) + 4;
            const x = clamp(g.xc(i), tw / 2, width - tw / 2);
            const y = p.r >= 0 ? g.y(p.r) - 6 : g.y(p.r) + 15;
            return (
              <text
                key={`best${p.lag}`}
                x={x}
                y={y}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="var(--ink)"
                className="num"
                stroke="var(--surface)"
                strokeWidth={3}
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                {text}
              </text>
            );
          })}

          {/* Sumbu-x */}
          {points.map((p, i) =>
            i % g.labelStep === 0 ? (
              <text key={`x${p.lag}`} x={g.xc(i)} y={g.bottomY + 16} textAnchor="middle" className="num" {...textProps}>
                {fmtInt(p.lag)}
              </text>
            ) : null,
          )}
          <text x={g.left} y={g.bottomY + 35} fontSize={11} fill="var(--ink-2)">
            {g.xTitle}
          </text>
        </svg>

        {activePoint && active !== null && (
          <ChartTooltip
            x={g.xc(active)}
            y={Math.min(g.y(activePoint.r), g.y(0))}
            boundsWidth={width}
            boundsHeight={height}
            offset={g.barW / 2 + 10}
          >
            <div className="num font-semibold text-ink">
              Jeda {fmtInt(activePoint.lag)} minggu · r = {fmtR(activePoint.r)}
            </div>
            {activePoint.lag === bestLag && <div className="text-[11px] text-ink-2">Korelasi terkuat</div>}
            {cfg.lags.includes(activePoint.lag) && <div className="text-[11px] text-ink-2">Termasuk jendela mesin risiko</div>}
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}
