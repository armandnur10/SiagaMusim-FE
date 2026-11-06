/**
 * Ringkasan siap-tampil di atas mesin risiko: dipakai bersama oleh halaman publik & dasbor
 * supaya angka dan kalimatnya konsisten di semua layar.
 */
import { DISEASES, DISEASE_IDS, LEVELS } from '@/lib/config';
import { forecast } from '@/lib/engines/forecast';
import { assess, assessMany, countByLevel } from '@/lib/engines/risk';
import { fmtDec, fmtInt } from '@/lib/format';
import type { AlertLevel, Assessment, Dataset, DiseaseId, Forecast } from '@/types/ews';

export interface DiseaseSummary {
  disease: DiseaseId;
  /** Penilaian tingkat kota. */
  city: Assessment;
  /** Proyeksi tingkat kota. */
  cityForecast: Forecast;
  /** Jumlah kelurahan per level. */
  counts: Record<AlertLevel, number>;
  /** Kelurahan berstatus Siaga atau Awas. */
  elevated: number;
  /** Penilaian semua kelurahan, urut dari yang paling perlu perhatian. */
  ranked: Assessment[];
  /** Judul satu kalimat (apa yang terjadi). */
  headline: string;
  /** Kalimat pendukung (mengapa & apa berikutnya). */
  detail: string;
}

/** Urutkan: level terberat dulu, lalu skor, lalu jumlah kasus. */
export function rankAssessments(list: Assessment[]): Assessment[] {
  return [...list].sort(
    (a, b) => LEVELS[b.level].rank - LEVELS[a.level].rank || b.score - a.score || b.cases - a.cases,
  );
}

const ratioText = (cases: number, expected: number): string | null => {
  if (expected < 1) return null;
  const r = cases / expected;
  if (r >= 1.15) return `${fmtDec(r, 1)}× rata-rata historis`;
  if (r <= 0.85) return `${Math.round((1 - r) * 100)}% di bawah rata-rata historis`;
  return 'setara rata-rata historis';
};

export function summarizeDisease(ds: Dataset, disease: DiseaseId, weekIndex: number = ds.latestWeek): DiseaseSummary {
  const d = DISEASES[disease];
  const city = assess(ds, ds.cityId, disease, weekIndex);
  const cityForecast = forecast(ds, ds.cityId, disease, weekIndex);
  const ranked = rankAssessments(assessMany(ds, ds.kelurahanIds, disease, weekIndex));
  const counts = countByLevel(ranked);
  const elevated = counts.siaga + counts.awas;
  const total = ds.kelurahanIds.length;

  // --- Judul: apa yang terjadi ---
  const ratio = ratioText(city.cases, city.expected);
  let headline: string;
  if (city.level === 'awas' || city.level === 'siaga') {
    const vsThreshold = city.cases > city.threshold ? `melampaui ambang historis (${fmtInt(city.threshold)})` : ratio;
    headline = `${d.short} ${LEVELS[city.level].label} di tingkat kota: ${fmtInt(city.cases)} kasus minggu ini${vsThreshold ? `, ${vsThreshold}` : ''}.`;
  } else if (elevated > 0) {
    headline =
      city.level === 'waspada'
        ? `${d.short} Waspada di tingkat kota, dan ${elevated} kelurahan sudah berstatus Siaga atau Awas.`
        : `${d.short} normal di tingkat kota, tetapi ${elevated} kelurahan berstatus Siaga atau Awas.`;
  } else if (city.level === 'waspada') {
    headline = `${d.short} Waspada: belum ada lonjakan, namun sinyal awal mulai muncul.`;
  } else {
    headline = `${d.short} dalam pola normal: ${fmtInt(city.cases)} kasus minggu ini${ratio ? `, ${ratio}` : ''}.`;
  }

  // --- Detail: mengapa & apa berikutnya ---
  const parts: string[] = [];
  if (elevated > 0 && (city.level === 'awas' || city.level === 'siaga')) {
    parts.push(`${elevated} dari ${total} kelurahan berstatus Siaga atau Awas.`);
  }
  if (city.signals.cuaca >= 75) {
    parts.push(
      disease === 'muntaber'
        ? 'Hujan sangat lebat dalam 3 minggu terakhir meningkatkan risiko air dan makanan tercemar.'
        : `Hujan beberapa minggu terakhir tinggi; dampaknya pada kasus biasanya muncul ${d.lagLabel} setelah hujan.`,
    );
  }
  if (cityForecast.exceedsAtHorizon !== null) {
    parts.push(
      cityForecast.exceedsAtHorizon === 1
        ? 'Proyeksi minggu depan masih di atas ambang historis.'
        : `Proyeksi melampaui ambang historis dalam ${cityForecast.exceedsAtHorizon} minggu.`,
    );
  } else if (cityForecast.direction === 'naik') {
    parts.push('Proyeksi 4 minggu ke depan naik, tetapi masih di bawah ambang.');
  } else if (cityForecast.direction === 'turun') {
    parts.push('Proyeksi 4 minggu ke depan cenderung turun.');
  } else {
    parts.push('Proyeksi 4 minggu ke depan relatif stabil.');
  }

  return { disease, city, cityForecast, counts, elevated, ranked, headline, detail: parts.join(' ') };
}

export function summarizeAll(ds: Dataset, weekIndex: number = ds.latestWeek): Record<DiseaseId, DiseaseSummary> {
  return {
    dbd: summarizeDisease(ds, 'dbd', weekIndex),
    muntaber: summarizeDisease(ds, 'muntaber', weekIndex),
    influenza: summarizeDisease(ds, 'influenza', weekIndex),
  };
}

/** Penilaian satu wilayah untuk ketiga penyakit + level terberatnya. */
export function assessRegionAll(
  ds: Dataset,
  regionId: string,
  weekIndex: number = ds.latestWeek,
): { byDisease: Record<DiseaseId, Assessment>; worst: Assessment } {
  const byDisease = {
    dbd: assess(ds, regionId, 'dbd', weekIndex),
    muntaber: assess(ds, regionId, 'muntaber', weekIndex),
    influenza: assess(ds, regionId, 'influenza', weekIndex),
  };
  const worst = rankAssessments(DISEASE_IDS.map((d) => byDisease[d]))[0];
  return { byDisease, worst };
}

/** Pencarian kelurahan sederhana (nama kelurahan atau kecamatan), tidak peka huruf besar/kecil. */
export function searchKelurahan(ds: Dataset, query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const id of ds.kelurahanIds) {
    const r = ds.regions[id];
    const name = r.name.toLowerCase();
    const kec = (r.kecamatan ?? '').toLowerCase();
    if (name.startsWith(q)) starts.push(id);
    else if (name.includes(q) || kec.includes(q)) contains.push(id);
  }
  return [...starts, ...contains].slice(0, limit);
}
