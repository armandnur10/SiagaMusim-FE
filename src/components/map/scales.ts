import { DISEASES, LEVELS, RAIN } from '@/lib/config';
import { fmtDec, fmtInt } from '@/lib/format';
import type { Assessment, Dataset, DiseaseId } from '@/types/ews';

/** Besaran yang diwarnai pada peta. */
export type MapMetric = 'level' | 'incidence' | 'rain';

/**
 * Persentil (dari seluruh nilai insidensi kelurahan-minggu yang TIDAK nol) yang menjadi
 * batas kelas. Dua kelas teratas sengaja sempit (10% dan 2,5% teratas) supaya titik panas
 * menonjol, sementara keadaan sehari-hari tetap di warna terang.
 */
const BREAK_QUANTILES = [0.25, 0.5, 0.75, 0.9, 0.975];

/** Angka "bulat" yang enak dibaca di legenda: 1 · 1,5 · 2 · 2,5 · 3 · 4 · 5 · 6 · 8 × 10^k. */
const NICE_MANTISSAS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
const NICE_NUMBERS: number[] = (() => {
  const out: number[] = [];
  for (let k = -2; k <= 5; k++) {
    for (const m of NICE_MANTISSAS) {
      const v = Number((m * 10 ** k).toPrecision(3));
      // Di atas 1 hanya bilangan bulat (3, 5, 8, 15, 25 …) agar label legenda ringkas.
      if (v < 1 || Number.isInteger(v)) out.push(v);
    }
  }
  return out;
})();

function niceRound(v: number): number {
  let best = NICE_NUMBERS[0];
  let bestDist = Infinity;
  for (const c of NICE_NUMBERS) {
    const dist = Math.abs(Math.log(c / v));
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

function quantile(sorted: number[], p: number): number {
  const pos = p * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const breaksCache = new WeakMap<Dataset, Map<DiseaseId, number[]>>();

/**
 * Batas kelas insidensi mingguan (per 100.000 penduduk) untuk peta satu penyakit.
 * Diturunkan SEKALI dari seluruh riwayat kelurahan pada dataset (bukan per minggu), sehingga
 * warna peta tetap sebanding saat pengguna memutar waktu. Menghasilkan `ramp.length - 1`
 * angka menaik (5 batas untuk 6 kelas). Nilai di bawah batas pertama, termasuk nol kasus,
 * masuk kelas paling terang.
 */
export function getIncidenceBreaks(dataset: Dataset, disease: DiseaseId): number[] {
  let byDisease = breaksCache.get(dataset);
  if (!byDisease) {
    byDisease = new Map();
    breaksCache.set(dataset, byDisease);
  }
  const hit = byDisease.get(disease);
  if (hit) return hit;

  const values: number[] = [];
  for (const id of dataset.kelurahanIds) {
    const population = dataset.regions[id]?.population ?? 0;
    const cases = dataset.series[id]?.cases[disease];
    if (!cases || population <= 0) continue;
    for (let t = 0; t <= dataset.latestWeek && t < cases.length; t++) {
      if (cases[t] > 0) values.push((cases[t] / population) * 100000);
    }
  }
  values.sort((a, b) => a - b);

  const count = DISEASES[disease].ramp.length - 1;
  const probs =
    count === BREAK_QUANTILES.length ? BREAK_QUANTILES : Array.from({ length: count }, (_, i) => (i + 1) / (count + 1));

  const breaks: number[] = [];
  for (const p of probs) {
    let b = values.length > 0 ? niceRound(quantile(values, p)) : 0;
    const prev = breaks.length > 0 ? breaks[breaks.length - 1] : 0;
    // Jaga agar batas selalu menaik: bila terbentur, ambil angka bulat berikutnya.
    if (b <= prev) b = NICE_NUMBERS.find((c) => c > prev) ?? prev * 2;
    breaks.push(b);
  }
  byDisease.set(disease, breaks);
  return breaks;
}

/** Indeks kelas 0..breaks.length: jumlah batas yang sudah dicapai nilai (batas bawah inklusif). */
export function classIndex(value: number, breaks: readonly number[]): number {
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return i;
}

/** Warna kelas insidensi dari ramp penyakit. */
export function incidenceColor(disease: DiseaseId, ratePer100k: number, breaks: readonly number[]): string {
  const ramp = DISEASES[disease].ramp;
  return ramp[Math.min(ramp.length - 1, classIndex(ratePer100k, breaks))];
}

/** Warna kelas curah hujan mingguan (mm) dari `RAIN.ramp` / `RAIN.breaks`. */
export function rainColor(mm: number): string {
  return RAIN.ramp[Math.min(RAIN.ramp.length - 1, classIndex(mm, RAIN.breaks))];
}

/** Warna isian satu wilayah untuk besaran yang dipilih. `breaks` hanya dipakai untuk 'incidence'. */
export function metricColor(metric: MapMetric, a: Assessment, breaks: readonly number[]): string {
  if (metric === 'incidence') return incidenceColor(a.disease, a.incidenceRate, breaks);
  if (metric === 'rain') return rainColor(a.rainThisWeek);
  return LEVELS[a.level].color;
}

/** Label batas kelas: bilangan bulat apa adanya, pecahan dengan satu desimal ("2,5"). */
export const fmtBreak = (n: number): string => (Number.isInteger(n) ? fmtInt(n) : fmtDec(n, n < 0.1 ? 2 : 1));

/** Label rentang tiap kelas, dari terendah: "< 3", "3–5", …, "≥ 25". */
export function rangeLabels(breaks: readonly number[]): string[] {
  const out: string[] = [];
  for (let i = 0; i <= breaks.length; i++) {
    if (i === 0) out.push(`< ${fmtBreak(breaks[0])}`);
    else if (i === breaks.length) out.push(`≥ ${fmtBreak(breaks[i - 1])}`);
    else out.push(`${fmtBreak(breaks[i - 1])}–${fmtBreak(breaks[i])}`);
  }
  return out;
}

export interface RampScale {
  /** Warna tiap kelas, terang -> gelap. */
  colors: readonly string[];
  /** Batas kelas menaik; panjang = colors.length - 1. */
  breaks: readonly number[];
}

/** Skala bertingkat (warna + batas) untuk besaran numerik pada peta. */
export function getRampScale(metric: Exclude<MapMetric, 'level'>, dataset: Dataset, disease: DiseaseId): RampScale {
  if (metric === 'rain') return { colors: RAIN.ramp, breaks: RAIN.breaks };
  return { colors: DISEASES[disease].ramp, breaks: getIncidenceBreaks(dataset, disease) };
}
