import { niceAxis, safeMax } from '@/components/charts/chartUtils';
import { fmtDec, fmtInt } from '@/lib/format';
import type { Assessment, Forecast, ForecastPoint, RegionInfo, WeekInfo } from '@/types/ews';

/** Angka kasus yang bisa pecahan (rata-rata, ambang, proyeksi): satu desimal, bulat bila sudah ratusan. */
export const fmtCases = (v: number): string => (Math.abs(v) >= 100 ? fmtInt(v) : fmtDec(v, 1));

/** Nama tampil wilayah: kecamatan diberi awalan agar tidak tertukar dengan kelurahan bernama sama. */
export const regionTitle = (r: RegionInfo): string => (r.kind === 'kecamatan' ? `Kec. ${r.name}` : r.name);

export const regionHref = (id: string): string => `/dashboard/wilayah/${id}`;

// ---------------------------------------------------------------------------
// Rentang waktu
// ---------------------------------------------------------------------------
export type RangeId = '26' | '52' | '104' | 'semua';

export const RANGE_OPTIONS: { id: RangeId; label: string; short: string; weeks: number | null }[] = [
  { id: '26', label: '26 minggu', short: '26 mgg', weeks: 26 },
  { id: '52', label: '52 minggu', short: '52 mgg', weeks: 52 },
  { id: '104', label: '104 minggu', short: '104 mgg', weeks: 104 },
  { id: 'semua', label: 'Semua', short: 'Semua', weeks: null },
];

/** Rentang selalu berakhir pada minggu yang dilihat; awalnya dibatasi di indeks 0. */
export function resolveRange(id: RangeId, weekIndex: number): { from: number; to: number } {
  const opt = RANGE_OPTIONS.find((o) => o.id === id);
  const span = opt?.weeks ?? null;
  return { from: span === null ? 0 : Math.max(0, weekIndex - span + 1), to: weekIndex };
}

// ---------------------------------------------------------------------------
// Proyeksi
// ---------------------------------------------------------------------------
/** Keterangan satu frasa tentang hubungan proyeksi dengan ambang historis. */
export function exceedText(a: Assessment, f: Forecast): string {
  const h = f.exceedsAtHorizon;
  if (h === null) return a.cases > a.threshold ? 'Kembali ke bawah ambang' : 'Tetap di bawah ambang';
  if (h === 1 && a.cases > a.threshold) return 'Masih di atas ambang minggu depan';
  return h === 1 ? 'Melewati ambang minggu depan' : `Melewati ambang dalam ${h} minggu`;
}

// ---------------------------------------------------------------------------
// Penyelarasan strip status dengan grafik utama
// ---------------------------------------------------------------------------
/**
 * Inset horizontal area plot RainCaseChart (mode non-compact), dihitung ulang dengan rumus yang
 * sama seperti di komponen grafik, supaya strip "Riwayat status" di bawahnya sejajar per minggu.
 * `futureShare` = porsi lebar plot yang dipakai slot proyeksi di sisi kanan.
 */
export function rainCaseInsets(input: {
  rain: number[];
  cases: number[];
  expected: number[];
  threshold: number[];
  from: number;
  to: number;
  forecast: ForecastPoint[];
}): { left: number; right: number; futureShare: number } {
  const { from, to, forecast } = input;
  const n = to - from + 1;
  const f = forecast.reduce((m, p) => Math.max(m, p.horizon), 0);
  const slice = (arr: number[]) => arr.slice(from, to + 1);
  const casesMax = Math.max(
    safeMax(slice(input.cases)),
    safeMax(slice(input.expected)),
    safeMax(slice(input.threshold)),
    safeMax(forecast.map((p) => Math.max(p.expected, p.high, p.baseline, p.threshold))),
  );
  const rainAxis = niceAxis(0, safeMax(slice(input.rain)), 2, false, 50);
  const casesAxis = niceAxis(0, casesMax, 4, true, 4);
  const maxChars = Math.max(...casesAxis.ticks.map((t) => fmtInt(t).length), ...rainAxis.ticks.map((t) => fmtInt(t).length));
  return { left: Math.max(28, Math.ceil(maxChars * 6.4) + 10), right: 12, futureShare: f / (n + f) };
}

// ---------------------------------------------------------------------------
// Perbandingan antartahun
// ---------------------------------------------------------------------------
export interface YtdComparison {
  year: number;
  isoWeek: number;
  current: number;
  /** null bila tahun sebelumnya tidak punya data lengkap untuk periode yang sama. */
  previous: number | null;
  /** Selisih relatif dalam persen; null bila tidak bisa dihitung. */
  pct: number | null;
}

/** Kumulatif sejak awal tahun s.d. minggu yang dilihat, dibanding periode yang sama tahun sebelumnya. */
export function ytdComparison(weeks: WeekInfo[], values: number[], weekIndex: number): YtdComparison {
  const { isoYear: year, isoWeek } = weeks[weekIndex];
  let current = 0;
  let curCount = 0;
  let previous = 0;
  let prevCount = 0;
  for (let i = 0; i <= weekIndex; i++) {
    const w = weeks[i];
    if (w.isoWeek > isoWeek) continue;
    if (w.isoYear === year) {
      current += values[i];
      curCount++;
    } else if (w.isoYear === year - 1) {
      previous += values[i];
      prevCount++;
    }
  }
  const comparable = prevCount > 0 && prevCount >= curCount;
  return {
    year,
    isoWeek,
    current,
    previous: comparable ? previous : null,
    pct: comparable && previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
}

/** Kalimat baca untuk perbandingan kumulatif. `subject` mis. "kasus DBD", `fmt` memformat jumlahnya. */
export function ytdSentence(c: YtdComparison, subject: string, fmt: (v: number) => string): string {
  const head = `Hingga minggu ke-${c.isoWeek}, ${subject} tahun ${c.year} berjumlah ${fmt(c.current)}`;
  if (c.previous === null) return `${head}. Belum ada data tahun ${c.year - 1} untuk periode yang sama sebagai pembanding.`;
  if (c.pct === null) return `${head}; pada periode yang sama ${c.year - 1} tidak ada yang tercatat.`;
  const abs = Math.abs(Math.round(c.pct));
  if (abs < 3) return `${head}, hampir sama dengan periode yang sama ${c.year - 1} (${fmt(c.previous)}).`;
  return `${head}, ${abs}% lebih ${c.pct > 0 ? 'tinggi' : 'rendah'} dari periode yang sama ${c.year - 1} (${fmt(c.previous)}).`;
}

// ---------------------------------------------------------------------------
// Korelasi
// ---------------------------------------------------------------------------
export function correlationStrength(r: number): string {
  if (r >= 0.6) return 'kuat';
  if (r >= 0.35) return 'sedang';
  if (r >= 0.15) return 'lemah';
  return 'sangat lemah';
}
