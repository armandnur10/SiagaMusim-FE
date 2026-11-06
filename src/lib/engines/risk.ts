/**
 * MESIN RISIKO — Siaga Musim
 * ---------------------------------------------------------------------------
 * Seluruh logika deterministik & transparan (tanpa "kotak hitam"), sehingga bisa
 * dijelaskan apa adanya di halaman Metodologi.
 *
 * Untuk tiap (wilayah, penyakit, minggu) dihitung tiga sinyal 0-100:
 *
 *  1. SINYAL KASUS (bobot 50%) — apakah kasus di atas pola normalnya?
 *     - Kasus harapan μ = rata-rata kasus pada minggu kalender yang sama (±2 minggu)
 *       di tahun-tahun lain; σ = simpangan bakunya (minimal √μ, sifat data cacah).
 *     - Ambang = μ + 2σ  (pendekatan "kanal endemis" yang lazim di surveilans).
 *     - z = (rata-rata kasus 2 minggu terakhir − μ) / σ ; skor = 20 + 27,5·z.
 *       -> z=0 (tepat normal) = 20, z=2 (di ambang) = 75, z≈3 = 100.
 *
 *  2. SINYAL CUACA (bobot 30%) — indikator pendahulu (leading indicator).
 *     - Paparan hujan terkini E = rata-rata tertimbang curah hujan beberapa minggu
 *       TERAKHIR, dengan bobot mengikuti jeda khas penyakit. Hujan ini belum tentu
 *       sudah menjadi kasus: dampaknya muncul 4-9 minggu lagi (DBD), 0-2 minggu
 *       (muntaber), atau 1-3 minggu (influenza).
 *     - Skor = persentil E terhadap seluruh riwayat wilayah itu (0-100).
 *
 *  3. SINYAL TREN (bobot 20%) — apakah kasus sedang menanjak?
 *     - g = (kasus 3 mgg terakhir − 3 mgg sebelumnya) / kasus 3 mgg sebelumnya
 *     - skor = 40 + 60·g·k  (datar = 40). k (0-1) meredam kenaikan yang belum
 *       bermakna secara statistik pada angka kecil (mis. 1 -> 2 kasus).
 *
 *  SKOR = 0,5·Kasus + 0,3·Cuaca + 0,2·Tren
 *  LEVEL: <40 Normal · 40-59 Waspada · 60-79 Siaga · ≥80 Awas
 *  (hujan pada kuartil teratas saja, dengan kasus normal, sudah cukup untuk Waspada)
 *
 *  ATURAN BUKTI KASUS (agar peringatan tidak digerakkan cuaca semata):
 *   a. Cuaca saja paling tinggi menghasilkan WASPADA. Siaga mensyaratkan kasus
 *      teramati di atas rata-rata (z ≥ 1, atau minggu ini melampaui ambang) DAN
 *      kasus minggu ini masih di atas rata-rata historisnya.
 *   b. AWAS mensyaratkan kasus melampaui ambang (minggu ini, atau rata-rata 2 minggu).
 *   c. Kasus di atas ambang ≥2 minggu berturut-turut -> minimal SIAGA.
 */
import { DISEASES, LEVELS, LEVEL_ORDER, SCORE_WEIGHTS } from '@/lib/config';
import type { AlertLevel, Assessment, Dataset, DiseaseId } from '@/types/ews';
import { clamp, mean, percentileRank, sampleSd } from './stats';

const WEEKS_PER_YEAR = 52;
const BASELINE_HALF_WINDOW = 2;
const MIN_SIGMA = 0.6;
/** Jumlah minggu masa depan yang ikut disiapkan baseline-nya (untuk proyeksi). */
export const FUTURE_PAD = 8;

export interface Prepared {
  /** Panjang deret teramati. */
  n: number;
  /** Nomor minggu ISO (1..53) untuk indeks 0..n+FUTURE_PAD-1. */
  weekOfYear: number[];
  yearOf: number[];
  /** Kasus harapan per indeks (termasuk FUTURE_PAD minggu ke depan). */
  mu: number[];
  /** Simpangan baku efektif per indeks. */
  sigma: number[];
  /** Paparan hujan terkini (bobot jeda diterapkan pada minggu-minggu terakhir), indeks 0..n-1. */
  exposure: number[];
  /** Paparan hujan klimatologis per indeks (termasuk masa depan). */
  exposureNormal: number[];
  exposureSorted: number[];
  /** Curah hujan klimatologis per minggu-kalender 1..53 (indeks 0 tidak dipakai). */
  rainClim: number[];
}

const circDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % WEEKS_PER_YEAR;
  return Math.min(d, WEEKS_PER_YEAR - d);
};

const preparedCache = new WeakMap<Dataset, Map<string, Prepared>>();

/** Menyiapkan baseline & paparan hujan satu (wilayah, penyakit). Hasil di-cache per dataset. */
export function prepare(ds: Dataset, regionId: string, disease: DiseaseId): Prepared {
  let byKey = preparedCache.get(ds);
  if (!byKey) {
    byKey = new Map();
    preparedCache.set(ds, byKey);
  }
  const key = `${regionId}|${disease}`;
  const hit = byKey.get(key);
  if (hit) return hit;

  const s = ds.series[regionId];
  if (!s) throw new Error(`Wilayah tidak dikenal: ${regionId}`);
  const cases = s.cases[disease];
  const rain = s.rain;
  const n = ds.weeks.length;
  const total = n + FUTURE_PAD;

  // Kalender (lanjutkan ke masa depan dengan menambah nomor minggu).
  const weekOfYear: number[] = [];
  const yearOf: number[] = [];
  for (let i = 0; i < total; i++) {
    if (i < n) {
      weekOfYear.push(ds.weeks[i].isoWeek);
      yearOf.push(ds.weeks[i].isoYear);
    } else {
      const prevW = weekOfYear[i - 1];
      const prevY = yearOf[i - 1];
      if (prevW >= WEEKS_PER_YEAR) {
        weekOfYear.push(1);
        yearOf.push(prevY + 1);
      } else {
        weekOfYear.push(prevW + 1);
        yearOf.push(prevY);
      }
    }
  }

  // Klimatologi hujan per minggu-kalender (rata-rata semua tahun, jendela ±1 minggu).
  const rainClim = new Array<number>(54).fill(0);
  for (let w = 1; w <= 53; w++) {
    const vals: number[] = [];
    for (let i = 0; i < n; i++) if (circDist(weekOfYear[i], w) <= 1) vals.push(rain[i]);
    rainClim[w] = mean(vals);
  }

  // Baseline kasus: minggu kalender yang sama (±2) pada tahun-tahun LAIN.
  const mu: number[] = [];
  const sigma: number[] = [];
  for (let i = 0; i < total; i++) {
    const vals: number[] = [];
    for (let j = 0; j < n; j++) {
      if (yearOf[j] === yearOf[i]) continue;
      if (circDist(weekOfYear[j], weekOfYear[i]) <= BASELINE_HALF_WINDOW) vals.push(cases[j]);
    }
    const m = mean(vals);
    mu.push(m);
    sigma.push(Math.max(sampleSd(vals), Math.sqrt(m), MIN_SIGMA));
  }

  // Paparan hujan TERKINI: bobot jeda diterapkan pada hujan minggu-minggu terakhir
  // (jeda terpendek -> minggu ini). Ini indikator pendahulu: hujan yang baru turun
  // dan akan berdampak pada kasus di jendela jeda penyakit.
  const { lags, lagWeights } = DISEASES[disease];
  const minLag = Math.min(...lags);
  const exposure: number[] = [];
  const exposureNormal: number[] = [];
  for (let i = 0; i < total; i++) {
    let e = 0;
    let en = 0;
    for (let k = 0; k < lags.length; k++) {
      const idx = i - (lags[k] - minLag);
      // Minggu-kalender pada indeks idx (boleh negatif / masa depan).
      const w = idx >= 0 && idx < total ? weekOfYear[idx] : ((((weekOfYear[0] - 1 + idx) % WEEKS_PER_YEAR) + WEEKS_PER_YEAR) % WEEKS_PER_YEAR) + 1;
      const clim = rainClim[w];
      const observed = idx >= 0 && idx < n ? rain[idx] : clim; // di luar data -> klimatologi
      e += lagWeights[k] * observed;
      en += lagWeights[k] * clim;
    }
    if (i < n) exposure.push(e);
    exposureNormal.push(en);
  }
  const exposureSorted = [...exposure].sort((a, b) => a - b);

  const prepared: Prepared = { n, weekOfYear, yearOf, mu, sigma, exposure, exposureNormal, exposureSorted, rainClim };
  byKey.set(key, prepared);
  return prepared;
}

export function levelFromScore(score: number): AlertLevel {
  let lv: AlertLevel = 'normal';
  for (const id of LEVEL_ORDER) if (score >= LEVELS[id].minScore) lv = id;
  return lv;
}

export const maxLevel = (a: AlertLevel, b: AlertLevel): AlertLevel => (LEVELS[a].rank >= LEVELS[b].rank ? a : b);

const assessCache = new WeakMap<Dataset, Map<string, Assessment>>();

/** Penilaian risiko satu wilayah-penyakit pada satu minggu. Hasil di-cache. */
export function assess(ds: Dataset, regionId: string, disease: DiseaseId, weekIndex: number = ds.latestWeek): Assessment {
  let byKey = assessCache.get(ds);
  if (!byKey) {
    byKey = new Map();
    assessCache.set(ds, byKey);
  }
  const t = clamp(Math.round(weekIndex), 0, ds.latestWeek);
  const key = `${regionId}|${disease}|${t}`;
  const hit = byKey.get(key);
  if (hit) return hit;

  const p = prepare(ds, regionId, disease);
  const region = ds.regions[regionId];
  const y = ds.series[regionId].cases[disease];
  const rain = ds.series[regionId].rain;
  const at = (i: number): number => (i >= 0 ? y[i] : y[0]);

  // --- 1. Sinyal kasus ---
  const t1 = Math.max(0, t - 1);
  const obs2 = (y[t] + y[t1]) / 2;
  const mu2 = (p.mu[t] + p.mu[t1]) / 2;
  const sigma2 = (p.sigma[t] + p.sigma[t1]) / 2;
  const zScore = (obs2 - mu2) / sigma2;
  const kasus = clamp(20 + 27.5 * zScore, 0, 100);

  const threshold = p.mu[t] + 2 * p.sigma[t];
  let weeksAbove = 0;
  for (let i = t; i >= 0; i--) {
    if (y[i] > p.mu[i] + 2 * p.sigma[i]) weeksAbove++;
    else break;
  }

  // --- 2. Sinyal cuaca ---
  const cuaca = percentileRank(p.exposureSorted, p.exposure[t]);

  // --- 3. Sinyal tren ---
  const recent3 = at(t) + at(t - 1) + at(t - 2);
  const prev3 = at(t - 3) + at(t - 4) + at(t - 5);
  const growth = clamp((recent3 - prev3) / Math.max(prev3, 3), -1, 1.5);
  // Peredam angka kecil: selisih akar (transformasi penstabil ragam data cacah).
  const confidence = clamp(Math.abs(Math.sqrt(recent3) - Math.sqrt(prev3)), 0, 1);
  const tren = clamp(40 + 60 * growth * confidence, 0, 100);

  // --- Skor & level ---
  const score = Math.round(SCORE_WEIGHTS.kasus * kasus + SCORE_WEIGHTS.cuaca * cuaca + SCORE_WEIGHTS.tren * tren);
  const scoreLevel = levelFromScore(score);
  let level = scoreLevel;
  let ruleNote: string | null = null;
  const aboveNow = y[t] > threshold;
  const aboveAvg2 = zScore >= 2;
  if (LEVELS[level].rank >= LEVELS.siaga.rank && zScore < 1 && !aboveNow) {
    level = 'waspada';
    ruleNote = 'Ditahan di Waspada: sinyal didominasi cuaca, kasus belum di atas pola normal.';
  } else if (LEVELS[level].rank >= LEVELS.siaga.rank && y[t] <= p.mu[t]) {
    level = 'waspada';
    ruleNote = 'Ditahan di Waspada: kasus minggu ini sudah kembali ke rata-rata historis atau di bawahnya.';
  } else if (level === 'awas' && !aboveNow && !aboveAvg2) {
    level = 'siaga';
    ruleNote = 'Ditahan di Siaga: kasus belum melampaui ambang historis.';
  }
  if (weeksAbove >= 2 && LEVELS[level].rank < LEVELS.siaga.rank) {
    level = 'siaga';
    ruleNote = `Dinaikkan ke Siaga: kasus di atas ambang ${weeksAbove} minggu berturut-turut.`;
  }

  // --- Penjelasan pemicu ---
  const d = DISEASES[disease];
  const drivers: string[] = [];
  const ratio = p.exposureNormal[t] > 0 ? p.exposure[t] / p.exposureNormal[t] : 1;
  const ratioText = ratio >= 1.15 ? `${ratio.toFixed(1).replace('.', ',')}× normal` : 'puncak musim hujan';
  if (weeksAbove >= 2) drivers.push(`Kasus di atas ambang ${weeksAbove} minggu berturut-turut`);
  else if (aboveNow) drivers.push('Kasus minggu ini melampaui ambang historis');
  else if (zScore >= 1) drivers.push('Rata-rata kasus 2 minggu terakhir di atas pola historis');
  if (cuaca >= 75) {
    drivers.push(
      disease === 'muntaber'
        ? `Hujan 3 minggu terakhir sangat tinggi (${ratioText}), risiko air tercemar`
        : `Hujan terkini tinggi (${ratioText}), kasus berpotensi naik ${d.lagLabel} setelahnya`,
    );
  } else if (cuaca >= 55) drivers.push('Hujan terkini di atas median historis');
  if (growth * confidence >= 0.4) drivers.push(`Kasus 3 minggu terakhir naik: ${prev3} → ${recent3}`);
  else if (growth * confidence <= -0.3) drivers.push(`Kasus 3 minggu terakhir turun: ${prev3} → ${recent3}`);
  if (drivers.length === 0) drivers.push('Kasus dan cuaca berada dalam pola musiman yang wajar');

  const result: Assessment = {
    regionId,
    disease,
    weekIndex: t,
    cases: y[t],
    casesPrev: t > 0 ? y[t - 1] : 0,
    incidenceRate: region.population > 0 ? (y[t] / region.population) * 100000 : 0,
    expected: p.mu[t],
    threshold,
    zScore,
    weeksAboveThreshold: weeksAbove,
    rainExposure: p.exposure[t],
    rainExposureNormal: p.exposureNormal[t],
    rainThisWeek: rain[t],
    casesRecent3: recent3,
    casesPrev3: prev3,
    trendPct: growth * 100,
    signals: { kasus: Math.round(kasus), cuaca: Math.round(cuaca), tren: Math.round(tren) },
    score,
    level,
    levelFromScore: scoreLevel,
    ruleNote,
    drivers,
  };
  byKey.set(key, result);
  return result;
}

/** Penilaian semua wilayah pada satu tingkat (kelurahan/kecamatan) untuk satu penyakit & minggu. */
export function assessMany(ds: Dataset, regionIds: string[], disease: DiseaseId, weekIndex: number = ds.latestWeek): Assessment[] {
  return regionIds.map((id) => assess(ds, id, disease, weekIndex));
}

export function countByLevel(list: Assessment[]): Record<AlertLevel, number> {
  const out: Record<AlertLevel, number> = { normal: 0, waspada: 0, siaga: 0, awas: 0 };
  for (const a of list) out[a.level]++;
  return out;
}

/** Deret ambang & harapan sepanjang waktu (untuk pita "pola normal" pada grafik). */
export function baselineSeries(ds: Dataset, regionId: string, disease: DiseaseId): { expected: number[]; threshold: number[] } {
  const p = prepare(ds, regionId, disease);
  const expected = p.mu.slice(0, p.n);
  const threshold = expected.map((m, i) => m + 2 * p.sigma[i]);
  return { expected, threshold };
}

/** Deret level sepanjang waktu (untuk "pita riwayat status"). */
export function levelHistory(ds: Dataset, regionId: string, disease: DiseaseId, from = 0, to: number = ds.latestWeek): AlertLevel[] {
  const out: AlertLevel[] = [];
  for (let t = from; t <= to; t++) out.push(assess(ds, regionId, disease, t).level);
  return out;
}
