'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { SeriesKey, type SeriesKeyKind } from './ChartLegend';
import { placeTooltip } from './chartUtils';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface ChartTooltipProps {
  /** Titik jangkar dalam px, relatif terhadap wadah `position: relative` terdekat. */
  x: number;
  y: number;
  /** Lebar wadah - tooltip dijaga tetap di dalamnya. */
  boundsWidth: number;
  /** Tinggi wadah (opsional; hanya dipakai penempatan 'side'). */
  boundsHeight?: number;
  /** 'side' = di samping jangkar (berbalik bila mentok); 'above' = di atas jangkar, terpusat. */
  placement?: 'side' | 'above';
  offset?: number;
  children: ReactNode;
}

/**
 * Tooltip HTML (overlay absolut). Induknya harus `position: relative`.
 * Tidak menangkap pointer; posisinya dihitung setelah ukurannya diketahui agar tidak keluar batas.
 */
export function ChartTooltip({ x, y, boundsWidth, boundsHeight, placement = 'side', offset = 14, children }: ChartTooltipProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { left, top } = placeTooltip({
      x,
      y,
      w: el.offsetWidth,
      h: el.offsetHeight,
      boundsW: boundsWidth,
      boundsH: boundsHeight,
      placement,
      offset,
    });
    el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    el.style.visibility = 'visible';
  });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-20 w-max rounded-lg border border-line bg-surface px-3 py-2 text-[12px] leading-4 text-ink shadow-pop"
      style={{ visibility: 'hidden', maxWidth: Math.max(140, Math.min(280, boundsWidth - 8)) }}
    >
      {children}
    </div>
  );
}

export interface TooltipHeaderProps {
  title: string;
  subtitle?: string;
  /** Label kecil di samping judul, mis. "Proyeksi". */
  tag?: string;
}

export function TooltipHeader({ title, subtitle, tag }: TooltipHeaderProps) {
  return (
    <div className="mb-1.5 border-b border-line pb-1.5">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-ink">{title}</span>
        {tag && (
          <span className="rounded bg-sunken px-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-2">{tag}</span>
        )}
      </div>
      {subtitle && <div className="num text-[11px] text-muted">{subtitle}</div>}
    </div>
  );
}

export interface TooltipRowProps {
  label: string;
  /** Nilai sudah terformat beserta satuannya. */
  value: string;
  swatch?: { kind: SeriesKeyKind; color: string; opacity?: number };
}

/** Satu baris tooltip: kunci seri + label (sekunder) di kiri, nilai (tebal) di kanan. */
export function TooltipRow({ label, value, swatch }: TooltipRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-px">
      <span className="inline-flex min-w-0 items-center gap-1.5 text-ink-2">
        {swatch ? <SeriesKey kind={swatch.kind} color={swatch.color} opacity={swatch.opacity} /> : null}
        <span>{label}</span>
      </span>
      <span className="num whitespace-nowrap font-semibold text-ink">{value}</span>
    </div>
  );
}

export interface TooltipNoteProps {
  children: ReactNode;
  /** Titik warna di depan catatan (mis. warna penyakit saat melampaui ambang). */
  dotColor?: string;
}

export function TooltipNote({ children, dotColor }: TooltipNoteProps) {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-ink">
      {dotColor ? <SeriesKey kind="dot" color={dotColor} /> : null}
      <span>{children}</span>
    </div>
  );
}
