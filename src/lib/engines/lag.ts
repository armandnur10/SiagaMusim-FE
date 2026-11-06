import type { Dataset, DiseaseId, LagCorrelationPoint } from '@/types/ews';
import { pearson } from './stats';

/**
 * Korelasi silang hujan(t−k) vs kasus(t) untuk k = 0..maxLag minggu.
 * Puncak korelasi menunjukkan berapa minggu hujan "mendahului" kasus.
 * Catatan: korelasi bukan bukti sebab-akibat; pola musiman bersama ikut menaikkan nilainya.
 */
export function lagCorrelation(
  ds: Dataset,
  regionId: string,
  disease: DiseaseId,
  maxLag = 12,
  range?: { from: number; to: number },
): { points: LagCorrelationPoint[]; bestLag: number; bestR: number } {
  const s = ds.series[regionId];
  const from = Math.max(0, range?.from ?? 0);
  const to = Math.min(ds.latestWeek, range?.to ?? ds.latestWeek);
  const points: LagCorrelationPoint[] = [];
  let bestLag = 0;
  let bestR = -Infinity;
  for (let lag = 0; lag <= maxLag; lag++) {
    const x: number[] = [];
    const y: number[] = [];
    for (let t = Math.max(from, lag); t <= to; t++) {
      x.push(s.rain[t - lag]);
      y.push(s.cases[disease][t]);
    }
    const r = pearson(x, y);
    points.push({ lag, r });
    if (r > bestR) {
      bestR = r;
      bestLag = lag;
    }
  }
  return { points, bestLag, bestR };
}
