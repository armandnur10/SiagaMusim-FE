/**
 * PROYEKSI INDIKATIF 4 MINGGU
 * ---------------------------------------------------------------------------
 * ŷ(t+h) = μ(t+h) × [ w·ρ + (1−w)·X(t+h) ],  w = 0,75^h
 *   μ(t+h) : kasus harapan historis pada minggu target
 *   ρ      : rasio kasus 3 minggu terakhir terhadap harapannya (kondisi saat ini)
 *   X(t+h) : rasio paparan hujan pada minggu target terhadap normalnya.
 *            Hujan yang SUDAH turun dipakai apa adanya; hujan yang belum terjadi
 *            diisi klimatologi. Untuk DBD (jeda 4-9 minggu) seluruh paparan
 *            sampai 4 minggu ke depan sudah teramati -> di situlah nilai "peringatan dini".
 * Jangka dekat mengikuti kondisi kasus saat ini; makin jauh makin mengikuti cuaca.
 * Rentang (low-high) melebar seiring horizon. Ini BUKAN model prediksi tervalidasi.
 */
import { DISEASES, FORECAST_HORIZON } from '@/lib/config';
import type { Dataset, DiseaseId, Forecast, ForecastPoint } from '@/types/ews';
import { prepare } from './risk';
import { clamp } from './stats';

const cache = new WeakMap<Dataset, Map<string, Forecast>>();

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function forecast(ds: Dataset, regionId: string, disease: DiseaseId, weekIndex: number = ds.latestWeek): Forecast {
  let byKey = cache.get(ds);
  if (!byKey) {
    byKey = new Map();
    cache.set(ds, byKey);
  }
  const t = clamp(Math.round(weekIndex), 0, ds.latestWeek);
  const key = `${regionId}|${disease}|${t}`;
  const hit = byKey.get(key);
  if (hit) return hit;

  const p = prepare(ds, regionId, disease);
  const y = ds.series[regionId].cases[disease];
  const rain = ds.series[regionId].rain;
  const { lags, lagWeights } = DISEASES[disease];

  // ρ: kondisi kasus saat ini relatif terhadap harapan (3 minggu terakhir).
  let obs = 0;
  let exp = 0;
  for (let i = Math.max(0, t - 2); i <= t; i++) {
    obs += y[i];
    exp += p.mu[i];
  }
  const rho = clamp((obs + 1) / (exp + 1), 0.3, 4);

  const points: ForecastPoint[] = [];
  let exceedsAtHorizon: number | null = null;
  for (let h = 1; h <= FORECAST_HORIZON; h++) {
    const target = t + h;
    // Paparan pada minggu target: hujan teramati hanya s.d. minggu t (tanpa "mengintip" masa depan).
    let e = 0;
    let en = 0;
    for (let k = 0; k < lags.length; k++) {
      const idx = target - lags[k];
      const w = p.weekOfYear[clamp(idx, 0, p.weekOfYear.length - 1)];
      const clim = p.rainClim[w];
      e += lagWeights[k] * (idx >= 0 && idx <= t ? rain[idx] : clim);
      en += lagWeights[k] * clim;
    }
    const x = clamp(en > 0 ? e / en : 1, 0.4, 3);
    const w = Math.pow(0.75, h);
    const mu = p.mu[Math.min(target, p.mu.length - 1)];
    const sigma = p.sigma[Math.min(target, p.sigma.length - 1)];
    const expected = Math.max(0, mu * (w * rho + (1 - w) * x));
    const spread = 1.28 * Math.sqrt(expected + Math.pow(0.2 * h * expected, 2));
    const threshold = mu + 2 * sigma;
    if (exceedsAtHorizon === null && expected > threshold) exceedsAtHorizon = h;
    const date = addDays(ds.weeks[t].date, 7 * h);
    points.push({
      horizon: h,
      date,
      isoWeek: p.weekOfYear[Math.min(target, p.weekOfYear.length - 1)],
      expected,
      low: Math.max(0, expected - spread),
      high: expected + spread,
      threshold,
      baseline: mu,
    });
  }

  const nowLevel = (y[t] + y[Math.max(0, t - 1)]) / 2;
  const future = (points[FORECAST_HORIZON - 1].expected + points[FORECAST_HORIZON - 2].expected) / 2;
  const change = (future - nowLevel) / Math.max(nowLevel, 1);
  const direction: Forecast['direction'] = change > 0.2 ? 'naik' : change < -0.2 ? 'turun' : 'stabil';

  const result: Forecast = { regionId, disease, weekIndex: t, points, exceedsAtHorizon, direction };
  byKey.set(key, result);
  return result;
}
