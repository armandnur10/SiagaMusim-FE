import clsx from 'clsx';

export type SeriesKeyKind = 'line' | 'dash' | 'rect' | 'dot' | 'band';

export interface SeriesKeyProps {
  kind: SeriesKeyKind;
  color: string;
  /** Opasitas tanda (untuk seri pembanding yang diredam). */
  opacity?: number;
}

/**
 * Kunci seri kecil yang meniru tandanya di grafik: garis untuk garis, kotak untuk batang/area,
 * titik untuk penanda, pita + garis putus untuk proyeksi. Identitas warna ada di sini - bukan pada teks.
 */
export function SeriesKey({ kind, color, opacity = 1 }: SeriesKeyProps) {
  const w = kind === 'rect' || kind === 'dot' ? 10 : 16;
  return (
    <svg width={w} height={10} viewBox={`0 0 ${w} 10`} aria-hidden="true" className="shrink-0">
      {kind === 'line' && <line x1={1} x2={15} y1={5} y2={5} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={opacity} />}
      {kind === 'dash' && (
        <line x1={1} x2={15} y1={5} y2={5} stroke={color} strokeWidth={1.5} strokeDasharray="4 3" opacity={opacity} />
      )}
      {kind === 'rect' && <rect x={0.5} y={0.5} width={9} height={9} rx={2} fill={color} opacity={opacity} />}
      {kind === 'dot' && <circle cx={5} cy={5} r={3.5} fill={color} opacity={opacity} />}
      {kind === 'band' && (
        <>
          <rect x={0} y={1} width={16} height={8} rx={2} fill={color} opacity={0.18 * opacity} />
          <line x1={1} x2={15} y1={5} y2={5} stroke={color} strokeWidth={2} strokeDasharray="4 3" opacity={opacity} />
        </>
      )}
    </svg>
  );
}

export interface LegendItem {
  /** Kunci React; default = label. */
  id?: string;
  label: string;
  kind: SeriesKeyKind;
  color: string;
  opacity?: number;
}

export interface ChartLegendProps {
  items: LegendItem[];
  className?: string;
}

/** Legenda ringkas: satu baris (membungkus bila sempit), rata kiri, teks memakai warna tinta. */
export function ChartLegend({ items, className }: ChartLegendProps) {
  if (items.length === 0) return null;
  return (
    <ul className={clsx('flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] leading-4 text-ink-2', className)}>
      {items.map((it) => (
        <li key={it.id ?? it.label} className="inline-flex items-center gap-1.5">
          <SeriesKey kind={it.kind} color={it.color} opacity={it.opacity} />
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
