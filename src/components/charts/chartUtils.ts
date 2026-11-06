/** Pembantu murni (tanpa React/DOM) untuk kit grafik. Semua fungsi aman terhadap masukan kosong/NaN. */
import { tickStep } from 'd3-array';
import { fmtDec, fmtInt, fmtMonth, fmtMonthYear } from '@/lib/format';
import type { WeekInfo } from '@/types/ews';

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Nilai larik pada indeks i; 0 bila tidak ada / bukan angka. */
export const at = (arr: readonly number[] | undefined, i: number): number => {
  const v = arr?.[i];
  return isNum(v) ? v : 0;
};

/** Nilai larik pada indeks i; null bila tidak ada / bukan angka. */
export const atOrNull = (arr: readonly number[] | undefined, i: number): number | null => {
  const v = arr?.[i];
  return isNum(v) ? v : null;
};

/** Maksimum yang aman (0 bila kosong; mengabaikan NaN). */
export function safeMax(values: Iterable<number | null | undefined>): number {
  let m = 0;
  for (const v of values) if (isNum(v) && v > m) m = v;
  return m;
}

/** Bilangan bulat tampil tanpa desimal; selain itu satu desimal. */
export const fmtValue = (v: number): string => (Number.isInteger(v) ? fmtInt(v) : fmtDec(v, 1));

// ---------------------------------------------------------------------------
// Sumbu linear
// ---------------------------------------------------------------------------
export interface LinearAxis {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/**
 * Sumbu dengan angka bulat rapi. `count` = perkiraan jumlah interval.
 * `integer` memaksa langkah >= 1 (untuk hitungan kasus). `fallbackMax` dipakai bila data kosong/nol semua.
 */
export function niceAxis(lo: number, hi: number, count: number, integer = false, fallbackMax = 1): LinearAxis {
  let a = isNum(lo) ? lo : 0;
  let b = isNum(hi) ? hi : 0;
  if (a > b) [a, b] = [b, a];
  if (b - a < 1e-9) b = a + (fallbackMax > 0 ? fallbackMax : 1);
  const n = Math.max(1, Math.round(count));
  let step = tickStep(a, b, n);
  if (!isNum(step) || step <= 0) step = b - a;
  if (integer) step = Math.max(1, Math.ceil(step));
  let i0 = Math.floor(a / step + 1e-9);
  let i1 = Math.max(i0 + 1, Math.ceil(b / step - 1e-9));
  // Jaga agar jumlah tik tidak berlebihan: naikkan langkah ke angka rapi berikutnya (1 -> 2 -> 5 -> 10).
  for (let guard = 0; guard < 6 && i1 - i0 > n + 1; guard++) {
    const pow = Math.pow(10, Math.floor(Math.log10(step) + 1e-9));
    const mant = step / pow;
    step = Number(((mant < 1.5 ? 2 : mant < 3.5 ? 5 : 10) * pow).toPrecision(12));
    i0 = Math.floor(a / step + 1e-9);
    i1 = Math.max(i0 + 1, Math.ceil(b / step - 1e-9));
  }
  const ticks: number[] = [];
  for (let i = i0; i <= i1; i++) ticks.push(Number((i * step).toFixed(10)));
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks };
}

/**
 * Menipiskan LABEL tik bila panel terlalu pendek: jarak antarlabel dijaga >= `minPx`.
 * Selalu mempertahankan tik pertama; bila kelipatan tidak pas, hanya tik pertama & terakhir.
 */
export function thinTicks(ticks: readonly number[], spanPx: number, minPx = 14): number[] {
  if (ticks.length <= 2) return [...ticks];
  const per = spanPx / (ticks.length - 1);
  if (!isNum(per) || per >= minPx) return [...ticks];
  const k = Math.ceil(minPx / Math.max(per, 0.01));
  if ((ticks.length - 1) % k !== 0) return [ticks[0], ticks[ticks.length - 1]];
  return ticks.filter((_, i) => i % k === 0);
}

// ---------------------------------------------------------------------------
// Batang
// ---------------------------------------------------------------------------
/**
 * Path batang dari garis dasar `y0` ke ujung data `y1` (px). Ujung data membulat `r`,
 * sisi garis dasar tetap siku. Mengembalikan '' bila tingginya nol.
 */
export function barPath(x: number, w: number, y0: number, y1: number, r: number): string {
  if (![x, w, y0, y1].every(isNum) || w <= 0) return '';
  const h = Math.abs(y1 - y0);
  if (h < 0.01) return '';
  const rr = Math.max(0, Math.min(r, w / 2, h));
  const s = y1 < y0 ? 1 : -1; // arah dari ujung data menuju garis dasar
  const f = (v: number) => Number(v.toFixed(2));
  if (rr < 0.5) return `M${f(x)},${f(y0)}V${f(y1)}H${f(x + w)}V${f(y0)}Z`;
  return (
    `M${f(x)},${f(y0)}V${f(y1 + s * rr)}Q${f(x)},${f(y1)} ${f(x + rr)},${f(y1)}` +
    `H${f(x + w - rr)}Q${f(x + w)},${f(y1)} ${f(x + w)},${f(y1 + s * rr)}V${f(y0)}Z`
  );
}

/** Lebar & celah batang untuk satu slot selebar `band`: maksimal 24px, minimal 1px, celah hilang saat sempit. */
export function barGeometry(band: number, maxWidth = 24): { width: number; gap: number } {
  const b = isNum(band) && band > 0 ? band : 1;
  const gap = b >= 9 ? 2 : b >= 4 ? 1 : 0;
  return { width: Math.max(1, Math.min(maxWidth, b - gap)), gap };
}

// ---------------------------------------------------------------------------
// Waktu
// ---------------------------------------------------------------------------
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Tahun & nomor minggu ISO 8601 untuk tanggal (YYYY-MM-DD). */
export function isoWeekOf(iso: string): { isoYear: number; isoWeek: number } {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return { isoYear: 0, isoWeek: 1 };
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // Kamis pada minggu yang sama
  const isoYear = d.getUTCFullYear();
  const jan1 = Date.UTC(isoYear, 0, 1);
  const isoWeek = Math.ceil(((d.getTime() - jan1) / 86400000 + 1) / 7);
  return { isoYear, isoWeek };
}

/** Membuat WeekInfo dari tanggal awal minggu (Senin) - dipakai untuk minggu proyeksi di luar dataset. */
export function weekFromStart(date: string, index: number, isoWeek?: number): WeekInfo {
  const iso = isoWeekOf(date);
  return { index, date, endDate: addDays(date, 6), isoYear: iso.isoYear, isoWeek: isNum(isoWeek) ? isoWeek : iso.isoWeek };
}

export interface TimeTick {
  /** Posisi pada larik minggu yang diberikan. */
  i: number;
  x: number;
  label: string;
}

const monthOf = (iso: string): number => Number(iso.slice(5, 7)) || 0;
const yearOf = (iso: string): number => Number(iso.slice(0, 4)) || 0;

/**
 * Tik sumbu waktu per BULAN (bukan per minggu). Tik jatuh pada minggu pertama yang dimulai di bulan baru.
 * Kerapatan diturunkan (tiap 1/2/3/6/12 bulan) sampai jarak antarlabel >= `minGap` px.
 * Tahun hanya ditulis pada Januari atau pada tik pertama.
 */
export function monthTicks(weeks: readonly Pick<WeekInfo, 'date'>[], xOf: (i: number) => number, minGap = 46): TimeTick[] {
  if (weeks.length === 0) return [];
  const cands: { i: number; x: number; month: number; date: string }[] = [];
  for (let i = 1; i < weeks.length; i++) {
    const m = monthOf(weeks[i].date);
    if (m !== monthOf(weeks[i - 1].date) || yearOf(weeks[i].date) !== yearOf(weeks[i - 1].date)) {
      const x = xOf(i);
      if (isNum(x)) cands.push({ i, x, month: m, date: weeks[i].date });
    }
  }
  if (cands.length === 0) {
    const x = xOf(0);
    return isNum(x) ? [{ i: 0, x, label: fmtMonthYear(weeks[0].date) }] : [];
  }
  const spaced = (list: typeof cands): boolean => {
    for (let k = 1; k < list.length; k++) if (list[k].x - list[k - 1].x < minGap) return false;
    return true;
  };
  let chosen: typeof cands = [];
  for (const step of [1, 2, 3, 6, 12]) {
    const list = cands.filter((c) => (c.month - 1) % step === 0);
    if (list.length > 0 && spaced(list)) {
      chosen = list;
      break;
    }
  }
  if (chosen.length === 0) {
    // Cadangan: penipisan serakah (mis. rentang sangat panjang pada layar sempit).
    const base = cands.filter((c) => c.month === 1);
    const pool = base.length > 0 ? base : cands;
    let lastX = -Infinity;
    for (const c of pool) {
      if (c.x - lastX >= minGap) {
        chosen.push(c);
        lastX = c.x;
      }
    }
  }
  return chosen.map((c, k) => ({
    i: c.i,
    x: c.x,
    label: c.month === 1 || k === 0 ? fmtMonthYear(c.date) : fmtMonth(c.date),
  }));
}

// ---------------------------------------------------------------------------
// Lain-lain
// ---------------------------------------------------------------------------
/** Mengelompokkan indeks menjadi rentang berurutan: [3,4,5,8] -> [[3,5],[8,8]]. */
export function contiguousRuns(indices: readonly number[]): [number, number][] {
  const sorted = [...new Set(indices.filter(isNum))].sort((p, q) => p - q);
  const runs: [number, number][] = [];
  for (const v of sorted) {
    const last = runs[runs.length - 1];
    if (last && v === last[1] + 1) last[1] = v;
    else runs.push([v, v]);
  }
  return runs;
}

/** Perkiraan lebar teks (px) untuk tata letak - cukup akurat untuk font sans 10-12px. */
export const estTextWidth = (text: string, fontSize = 11): number => text.length * fontSize * 0.56;

export interface TooltipPlacementInput {
  /** Titik jangkar (px, relatif terhadap wadah). */
  x: number;
  y: number;
  /** Ukuran tooltip. */
  w: number;
  h: number;
  /** Ukuran wadah. */
  boundsW: number;
  boundsH?: number;
  placement: 'side' | 'above';
  offset: number;
}

/** Posisi tooltip yang tetap berada di dalam batas horizontal wadah. */
export function placeTooltip(p: TooltipPlacementInput): { left: number; top: number } {
  const pad = 4;
  const x = isNum(p.x) ? p.x : 0;
  const y = isNum(p.y) ? p.y : 0;
  const maxLeft = Math.max(pad, p.boundsW - p.w - pad);
  if (p.placement === 'above') {
    return { left: clamp(x - p.w / 2, pad, maxLeft), top: y - p.h - p.offset };
  }
  let left = x + p.offset;
  if (left + p.w > p.boundsW - pad) left = x - p.offset - p.w;
  left = clamp(left, pad, maxLeft);
  let top = y - p.h / 2;
  if (isNum(p.boundsH)) top = clamp(top, pad, Math.max(pad, p.boundsH - p.h - pad));
  return { left, top };
}

/**
 * Menggeser label ujung-garis agar tidak bertumpuk: menjaga jarak minimal `minGap` px
 * dan tetap di dalam [lo, hi]. Mengembalikan posisi y baru dengan urutan masukan yang sama.
 */
export function spreadLabels(ys: readonly number[], minGap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y: isNum(y) ? y : lo, i })).sort((p, q) => p.y - q.y);
  const out = new Array<number>(ys.length).fill(lo);
  let prev = -Infinity;
  for (const o of order) {
    const y = Math.max(o.y, prev + minGap, lo);
    out[o.i] = y;
    prev = y;
  }
  // Bila melewati batas bawah, dorong kembali ke atas.
  let next = Infinity;
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k].i;
    const y = Math.min(out[i], next - minGap, hi);
    out[i] = y;
    next = y;
  }
  return out;
}
