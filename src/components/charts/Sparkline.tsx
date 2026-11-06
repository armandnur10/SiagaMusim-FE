import { fmtValue, isNum } from './chartUtils';

export interface SparklineProps {
  values: number[];
  /** Warna garis; default tinta sekunder (netral). */
  color?: string;
  width?: number;
  height?: number;
  /** Ambang per titik (sejajar indeks dengan `values`) - garis putus-putus samar. */
  threshold?: number[];
  highlightLast?: boolean;
  ariaLabel?: string;
  /** Isian tipis di bawah garis. */
  fill?: boolean;
}

/** Tren mini berukuran tetap untuk sel tabel/kartu. Tanpa sumbu dan tanpa tooltip. */
export function Sparkline({
  values,
  color = 'var(--ink-2)',
  width = 96,
  height = 28,
  threshold,
  highlightLast = true,
  ariaLabel,
  fill = false,
}: SparklineProps) {
  const w = Math.max(8, width);
  const h = Math.max(8, height);
  const pad = 3.5;
  const pts = values.map((v) => (isNum(v) ? v : 0));
  const n = pts.length;
  const thr = threshold ? pts.map((_, i) => (isNum(threshold[i]) ? threshold[i] : null)) : null;

  let lo = 0;
  let hi = 0;
  for (const v of pts) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (thr) for (const v of thr) if (v !== null && v > hi) hi = v;
  const span = hi - lo;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const x = (i: number) => (n <= 1 ? w - pad : pad + (i / (n - 1)) * innerW);
  const y = (v: number) => (span <= 0 ? h - pad : pad + (1 - (v - lo) / span) * innerH);
  const f = (v: number) => v.toFixed(1);

  const linePath = n >= 2 ? pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${f(x(i))},${f(y(v))}`).join('') : '';
  const areaPath = n >= 2 ? `${linePath}L${f(x(n - 1))},${f(y(lo))}L${f(x(0))},${f(y(lo))}Z` : '';

  let thrPath = '';
  if (thr && n >= 2) {
    let pen = false;
    thr.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      thrPath += `${pen ? 'L' : 'M'}${f(x(i))},${f(y(v))}`;
      pen = true;
    });
  }

  const last = n > 0 ? pts[n - 1] : null;
  const label =
    ariaLabel ??
    (n === 0
      ? 'Tren: belum ada data'
      : `Tren ${n} minggu: terakhir ${fmtValue(pts[n - 1])}, tertinggi ${fmtValue(Math.max(...pts))}`);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="block shrink-0 overflow-visible">
      {n === 0 && <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="var(--chart-axis)" strokeWidth={1} />}
      {fill && areaPath && <path d={areaPath} fill={color} opacity={0.1} />}
      {thrPath && <path d={thrPath} fill="none" stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 2" opacity={0.7} />}
      {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
      {last !== null && (highlightLast || n === 1) && (
        <circle cx={x(n - 1)} cy={y(last)} r={3} fill={color} stroke="var(--surface)" strokeWidth={1.5} />
      )}
    </svg>
  );
}
