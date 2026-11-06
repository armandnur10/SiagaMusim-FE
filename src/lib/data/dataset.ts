import { CITY_ID, CITY_NAME, DISEASE_IDS } from '@/lib/config';
import type { Dataset, DiseaseId, RegionInfo, RegionSeries, WeekInfo } from '@/types/ews';

/** Parser CSV minimal (mendukung tanda kutip ganda). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const splitLine = (line: string): string[] => {
    if (!line.includes('"')) return line.split(',');
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = splitLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const row: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) row[header[c]] = (cells[c] ?? '').trim();
    rows.push(row);
  }
  return rows;
}

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const CSV_DISEASE_COLUMN: Record<DiseaseId, string> = {
  dbd: 'insiden_dbd',
  muntaber: 'insiden_muntaber',
  influenza: 'insiden_influenza',
};

/**
 * Menyusun Dataset dari dua CSV:
 *  - wilayah  : id_kelurahan,kota,kecamatan,kelurahan,penduduk,luas_km2,lat,lon
 *  - deret    : tanggal,tahun,minggu_epi,kota,kecamatan,kelurahan,curah_hujan_mm,insiden_dbd,insiden_muntaber,insiden_influenza
 * Deret kecamatan & kota diturunkan di sini (kasus dijumlah, hujan dirata-rata tertimbang luas).
 */
export function buildDataset(timeseriesCsv: string, wilayahCsv: string): Dataset {
  const wilayahRows = parseCsv(wilayahCsv);
  const tsRows = parseCsv(timeseriesCsv);
  if (wilayahRows.length === 0 || tsRows.length === 0) throw new Error('Berkas CSV kosong atau tidak terbaca.');

  // --- Wilayah ---
  const regions: Record<string, RegionInfo> = {};
  const kelurahanIds: string[] = [];
  const kecMembers = new Map<string, string[]>();
  const kecNames = new Map<string, string>();
  for (const r of wilayahRows) {
    const id = r.id_kelurahan || slugify(r.kelurahan);
    const kecamatanId = 'kec-' + slugify(r.kecamatan);
    regions[id] = {
      id,
      kind: 'kelurahan',
      name: r.kelurahan,
      kecamatan: r.kecamatan,
      kecamatanId,
      population: Number(r.penduduk),
      areaKm2: Number(r.luas_km2),
      lat: Number(r.lat),
      lon: Number(r.lon),
      childIds: [],
    };
    kelurahanIds.push(id);
    kecNames.set(kecamatanId, r.kecamatan);
    if (!kecMembers.has(kecamatanId)) kecMembers.set(kecamatanId, []);
    kecMembers.get(kecamatanId)!.push(id);
  }

  // --- Minggu ---
  const dateSet = new Map<string, { isoYear: number; isoWeek: number }>();
  for (const r of tsRows) {
    if (!dateSet.has(r.tanggal)) dateSet.set(r.tanggal, { isoYear: Number(r.tahun), isoWeek: Number(r.minggu_epi) });
  }
  const dates = [...dateSet.keys()].sort();
  const weekIndex = new Map(dates.map((d, i) => [d, i] as const));
  const weeks: WeekInfo[] = dates.map((date, index) => ({
    index,
    date,
    endDate: addDays(date, 6),
    isoYear: dateSet.get(date)!.isoYear,
    isoWeek: dateSet.get(date)!.isoWeek,
  }));
  const n = weeks.length;

  // --- Deret kelurahan ---
  const emptySeries = (): RegionSeries => ({
    rain: new Array<number>(n).fill(0),
    cases: { dbd: new Array<number>(n).fill(0), muntaber: new Array<number>(n).fill(0), influenza: new Array<number>(n).fill(0) },
  });
  const series: Record<string, RegionSeries> = {};
  for (const id of kelurahanIds) series[id] = emptySeries();
  const nameToId = new Map(kelurahanIds.map((id) => [regions[id].name.toLowerCase(), id] as const));
  for (const r of tsRows) {
    const id = nameToId.get(r.kelurahan.toLowerCase());
    const t = weekIndex.get(r.tanggal);
    if (!id || t === undefined) continue;
    const s = series[id];
    s.rain[t] = Number(r.curah_hujan_mm) || 0;
    for (const d of DISEASE_IDS) s.cases[d][t] = Number(r[CSV_DISEASE_COLUMN[d]]) || 0;
  }

  // --- Agregasi kecamatan & kota ---
  const aggregate = (id: string, kind: 'kecamatan' | 'kota', name: string, childIds: string[]) => {
    const s = emptySeries();
    let pop = 0;
    let area = 0;
    let lat = 0;
    let lon = 0;
    for (const cid of childIds) {
      const c = regions[cid];
      const cs = series[cid];
      pop += c.population;
      area += c.areaKm2;
      lat += c.lat * c.areaKm2;
      lon += c.lon * c.areaKm2;
      for (let t = 0; t < n; t++) {
        s.rain[t] += cs.rain[t] * c.areaKm2;
        for (const d of DISEASE_IDS) s.cases[d][t] += cs.cases[d][t];
      }
    }
    for (let t = 0; t < n; t++) s.rain[t] = Math.round((s.rain[t] / area) * 10) / 10;
    regions[id] = { id, kind, name, population: pop, areaKm2: area, lat: lat / area, lon: lon / area, childIds };
    series[id] = s;
  };
  const kecamatanIds = [...kecMembers.keys()].sort((a, b) => kecNames.get(a)!.localeCompare(kecNames.get(b)!));
  for (const kid of kecamatanIds) aggregate(kid, 'kecamatan', kecNames.get(kid)!, kecMembers.get(kid)!);
  aggregate(CITY_ID, 'kota', CITY_NAME, kelurahanIds);

  kelurahanIds.sort((a, b) => regions[a].name.localeCompare(regions[b].name));

  return { weeks, latestWeek: n - 1, cityId: CITY_ID, kecamatanIds, kelurahanIds, regions, series };
}
