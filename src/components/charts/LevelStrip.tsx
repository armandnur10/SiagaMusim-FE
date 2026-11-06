'use client';

import { useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { LEVELS, LEVEL_ORDER } from '@/lib/config';
import { fmtInt, fmtWeekLong, fmtWeekRange } from '@/lib/format';
import type { AlertLevel, WeekInfo } from '@/types/ews';
import { ChartLegend, type LegendItem } from './ChartLegend';
import { ChartTooltip, TooltipHeader, TooltipRow } from './ChartTooltip';
import { clamp, isNum, monthTicks } from './chartUtils';
import { useElementWidth, useOutsideDismiss } from './useElementWidth';

export interface LevelStripProps {
  /** Level peringatan per minggu. */
  levels: AlertLevel[];
  /** Minggu yang sejajar indeks dengan `levels`. */
  weeks: WeekInfo[];
  /** Tinggi sel px. Default 20. */
  cellHeight?: number;
  /** Indeks (pada `levels`) yang diberi garis tepi tinta. */
  selectedIndex?: number;
  onSelect?: (i: number) => void;
  /** Baris legenda empat level di atas strip. Default false. */
  showLegend?: boolean;
  ariaLabel?: string;
}

const PAD = 3; // ruang untuk garis tepi sel terpilih
const TICK_BAND = 18;

const LEGEND_ITEMS: LegendItem[] = LEVEL_ORDER.map((l) => ({ id: l, label: LEVELS[l].label, kind: 'rect', color: LEVELS[l].color }));

const levelColor = (l: AlertLevel): string => LEVELS[l]?.color ?? 'var(--sunken)';
const levelLabel = (l: AlertLevel): string => LEVELS[l]?.label ?? 'Tidak diketahui';

/** Strip riwayat status: satu sel per minggu, diwarnai level peringatan (selalu disertai label di tooltip/legenda). */
export function LevelStrip({ levels, weeks, cellHeight = 20, selectedIndex, onSelect, showLegend = false, ariaLabel }: LevelStripProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const clipId = `ls-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [active, setActive] = useState<number | null>(null);
  useOutsideDismiss(rootRef, active !== null, () => setActive(null));

  const n = Math.min(levels.length, weeks.length);
  const ch = Math.max(6, cellHeight);
  const svgH = ch + PAD * 2 + TICK_BAND;

  const label = useMemo(() => {
    if (ariaLabel) return ariaLabel;
    if (n === 0) return 'Riwayat status peringatan: belum ada data';
    const counts = LEVEL_ORDER.map((l) => {
      let c = 0;
      for (let i = 0; i < n; i++) if (levels[i] === l) c++;
      return `${LEVELS[l].label} ${fmtInt(c)} minggu`;
    });
    return (
      `Riwayat status peringatan ${fmtInt(n)} minggu, ${fmtWeekLong(weeks[0])} sampai ${fmtWeekLong(weeks[n - 1])}: ` +
      `${counts.join(', ')}. Status terakhir: ${levelLabel(levels[n - 1])}.`
    );
  }, [ariaLabel, levels, weeks, n]);

  const geo = useMemo(() => {
    if (width <= 0 || n === 0) return null;
    const cw = width / n;
    const gap = cw >= 4 ? 1 : 0;
    const cells = Array.from({ length: n }, (_, i) => ({
      i,
      x: i * cw,
      w: gap > 0 ? cw - gap : Math.min(cw + 0.5, width - i * cw),
      color: levelColor(levels[i]),
    }));
    const ticks = monthTicks(weeks.slice(0, n), (i) => (i + 0.5) * cw, 48);
    return { cw, gap, cells, ticks };
  }, [width, n, levels, weeks]);

  const cellsLayer = useMemo(
    () =>
      geo ? (
        <g clipPath={`url(#${clipId})`}>
          {geo.cells.map((c) => (
            <rect key={c.i} x={c.x} y={PAD} width={c.w} height={ch} fill={c.color} />
          ))}
        </g>
      ) : null,
    [geo, clipId, ch],
  );

  const indexAt = (clientX: number, el: HTMLElement): number => {
    if (!geo) return 0;
    const rect = el.getBoundingClientRect();
    return clamp(Math.floor((clientX - rect.left) / geo.cw), 0, n - 1);
  };
  const track = (e: PointerEvent<HTMLDivElement>) => {
    const i = indexAt(e.clientX, e.currentTarget);
    setActive((prev) => (prev === i ? prev : i));
  };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onSelect || !geo) return;
    onSelect(indexAt(e.clientX, e.currentTarget));
    // Setelah memilih, rentang biasanya bergeser: tutup tooltip agar tidak menunjuk minggu yang salah.
    setActive(null);
  };
  const selIdx = isNum(selectedIndex) && selectedIndex >= 0 && selectedIndex < n ? Math.round(selectedIndex) : null;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    const cur = active ?? selIdx ?? n - 1;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = active === null ? cur : cur - 1;
    else if (e.key === 'ArrowRight') next = active === null ? cur : cur + 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') setActive(null);
    else if ((e.key === 'Enter' || e.key === ' ') && onSelect && active !== null) {
      e.preventDefault();
      onSelect(active);
    }
    if (next !== null) {
      e.preventDefault();
      setActive(clamp(next, 0, n - 1));
    }
  };
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (n > 0 && e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) {
      setActive((prev) => prev ?? selIdx ?? n - 1);
    }
  };

  const outline = (i: number, strong: boolean) => {
    if (!geo) return null;
    const w = Math.max(geo.cw - geo.gap, 4);
    const x = clamp(i * geo.cw + (geo.cw - geo.gap) / 2 - w / 2, 1, Math.max(1, width - w - 1));
    return (
      <rect
        x={x}
        y={PAD - 1}
        width={w}
        height={ch + 2}
        rx={2}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={strong ? 2 : 1.5}
        opacity={strong ? 1 : 0.55}
      />
    );
  };

  const activeIdx = active !== null && active < n ? active : null;

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={label}
      tabIndex={n > 0 ? 0 : undefined}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={() => setActive(null)}
      className="w-full min-w-0"
    >
      {showLegend && <ChartLegend items={LEGEND_ITEMS} className="mb-2" />}
      <div
        ref={ref}
        className="relative w-full select-none"
        style={{ height: svgH, touchAction: 'pan-y', cursor: onSelect && n > 0 ? 'pointer' : 'default' }}
        onPointerMove={geo ? track : undefined}
        onPointerDown={geo ? track : undefined}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') setActive(null);
        }}
        onClick={onClick}
      >
        {n === 0 ? (
          <div className="flex items-center text-[12px] text-muted" style={{ height: ch + PAD * 2 }}>
            Belum ada data
          </div>
        ) : geo ? (
          <svg width={width} height={svgH} aria-hidden="true" className="block overflow-visible">
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={PAD} width={width} height={ch} rx={Math.min(4, ch / 2)} />
              </clipPath>
            </defs>
            {cellsLayer}
            {geo.ticks.map((t) => {
              const anchor = t.x > width - 24 ? 'end' : t.x < 20 ? 'start' : 'middle';
              return (
                <g key={t.i}>
                  <line x1={t.x} x2={t.x} y1={ch + PAD + 2} y2={ch + PAD + 5} stroke="var(--chart-axis)" strokeWidth={1} />
                  <text x={t.x} y={ch + PAD * 2 + 13} textAnchor={anchor} fontSize={11} fill="var(--muted)" className="num">
                    {t.label}
                  </text>
                </g>
              );
            })}
            {activeIdx !== null && activeIdx !== selIdx && outline(activeIdx, false)}
            {selIdx !== null && outline(selIdx, true)}
          </svg>
        ) : null}

        {geo && activeIdx !== null && (
          <ChartTooltip x={(activeIdx + 0.5) * geo.cw} y={PAD} boundsWidth={width} placement="above" offset={8}>
            <TooltipHeader title={fmtWeekLong(weeks[activeIdx])} subtitle={fmtWeekRange(weeks[activeIdx])} />
            <TooltipRow label="Status" value={levelLabel(levels[activeIdx])} swatch={{ kind: 'rect', color: levelColor(levels[activeIdx]) }} />
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}
