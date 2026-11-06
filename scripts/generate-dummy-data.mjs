// =============================================================================
// Generator dataset DUMMY (sintetis) — EWS Penyakit Berbasis Cuaca, Jakarta Timur
// -----------------------------------------------------------------------------
// Menghasilkan dua berkas di public/data/:
//   1. wilayah_jakarta_timur.csv        -> referensi 65 kelurahan (penduduk, luas, koordinat)
//   2. ews_jakarta_timur_mingguan.csv   -> deret waktu mingguan per kelurahan
//
// SEMUA ANGKA ADALAH SIMULASI. Tidak ada data surveilans atau data BMKG asli.
// Yang dibuat realistis hanyalah *pola*-nya, supaya logika peringatan dini bisa diuji:
//   - Curah hujan mengikuti klimatologi monsun Jakarta (puncak Jan-Feb, kering Jul-Agu).
//   - DBD       : naik 4-9 minggu SETELAH hujan (siklus nyamuk Aedes + masa inkubasi).
//   - Muntaber  : naik 0-2 minggu setelah hujan EKSTREM, terutama di kelurahan rawan genangan.
//   - Influenza : mengikuti musim hujan dengan jeda 1-3 minggu + gelombang kecil pertengahan tahun.
//
// Deterministik: seed tetap -> hasil selalu sama. Jalankan: `npm run data:generate`
// =============================================================================
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO_PATH = join(ROOT, 'public', 'geo', 'jakarta-timur-kelurahan.geojson');
const OUT_DIR = join(ROOT, 'public', 'data');

const KOTA = 'Jakarta Timur';
const START_DATE = '2024-01-01'; // Senin, minggu ISO 1 tahun 2024
const N_WEEKS = 148; // s.d. minggu yang dimulai 2026-10-26 (minggu ISO 44/2026)
const SEED = 20261106;

// ---------- PRNG deterministik ------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
function randNormal() {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
/** Lognormal dengan rata-rata 1 (supaya tidak menggeser nilai harapan). */
const logNoise = (sigma) => Math.exp(sigma * randNormal() - (sigma * sigma) / 2);
function randGamma(shape) {
  if (shape < 1) return randGamma(shape + 1) * Math.pow(rand(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do {
      x = randNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function randPoisson(lambda) {
  if (lambda <= 0) return 0;
  if (lambda > 40) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * randNormal()));
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}
/** Hitungan kasus dengan overdispersi (negatif binomial = Poisson-Gamma). */
const randCases = (mean, k) => randPoisson(mean * (randGamma(k) / k));

// ---------- Geometri sederhana (tanpa dependensi) -----------------------------
function ringAreaKm2(ring) {
  // Luas poligon pada bola (rumus L'Huilier disederhanakan), cukup akurat untuk skala kota.
  const R = 6371.0088;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    total += ((lon2 - lon1) * Math.PI) / 180 * (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }
  return Math.abs((total * R * R) / 2);
}
function polygonAreaKm2(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let a = 0;
  for (const poly of polys) {
    a += ringAreaKm2(poly[0]);
    for (let i = 1; i < poly.length; i++) a -= ringAreaKm2(poly[i]);
  }
  return a;
}
function polygonCentroid(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let cx = 0;
  let cy = 0;
  let aSum = 0;
  for (const poly of polys) {
    const ring = poly[0];
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      const cross = x1 * y2 - x2 * y1;
      aSum += cross;
      cx += (x1 + x2) * cross;
      cy += (y1 + y2) * cross;
    }
  }
  return [cx / (3 * aSum), cy / (3 * aSum)];
}

// ---------- Kalender ---------------------------------------------------------
const DAY = 86400000;
const toISO = (d) => d.toISOString().slice(0, 10);
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / DAY + 1) / 7) };
}
const weeks = [];
{
  const start = new Date(START_DATE + 'T00:00:00Z');
  for (let i = 0; i < N_WEEKS; i++) {
    const d = new Date(start.getTime() + i * 7 * DAY);
    const mid = new Date(d.getTime() + 3 * DAY);
    const iw = isoWeek(d);
    weeks.push({ idx: i, date: toISO(d), mid, isoYear: iw.year, isoWeek: iw.week });
  }
}
const weekIndexOf = (iso) => {
  const i = weeks.findIndex((w) => w.date === iso);
  if (i < 0) throw new Error(`Tanggal ${iso} bukan awal minggu dalam rentang data`);
  return i;
};

// ---------- Wilayah ----------------------------------------------------------
const geo = JSON.parse(readFileSync(GEO_PATH, 'utf8'));

// Target penduduk per kecamatan (dibulatkan, skala realistis; total ~3,06 juta jiwa).
const KEC_POP = {
  Matraman: 172000,
  'Pulo Gadung': 289000,
  Jatinegara: 301000,
  'Duren Sawit': 421000,
  'Kramat Jati': 300000,
  Makasar: 205000,
  'Pasar Rebo': 224000,
  Ciracas: 301000,
  Cipayung: 289000,
  Cakung: 561000,
};
// Kelurahan dengan kepadatan jauh di bawah rata-rata kecamatannya (bandara, kawasan industri).
const DENSITY_WEIGHT = { 'Halim Perdana Kusuma': 0.22, 'Rawa Terate': 0.55, 'Cakung Barat': 0.8, Setu: 0.8, 'Pondok Ranggon': 0.75 };

// Indeks rawan genangan (0-1): kelurahan bantaran Ciliwung, Kali Sunter, Cipinang, dan Cakung Drain.
const FLOOD_PRONE = {
  'Kampung Melayu': 1.0, 'Bidara Cina': 1.0, Cawang: 0.95, Cililitan: 0.9, Balekambang: 0.85, 'Cipinang Melayu': 1.0,
  'Kebon Pala': 0.7, Makasar: 0.65, 'Cipinang Muara': 0.7, 'Cipinang Besar Selatan': 0.6, 'Rawa Terate': 0.7,
  'Cakung Timur': 0.65, 'Ujung Menteng': 0.6, Gedong: 0.6, 'Kebon Manggis': 0.6, Rambutan: 0.5,
};

const regions = geo.features.map((f) => {
  const [lon, lat] = polygonCentroid(f.geometry);
  return {
    id: f.properties.id,
    kelurahan: f.properties.kelurahan,
    kecamatan: f.properties.kecamatan,
    areaKm2: polygonAreaKm2(f.geometry),
    lat,
    lon,
  };
});
regions.sort((a, b) => a.kecamatan.localeCompare(b.kecamatan) || a.kelurahan.localeCompare(b.kelurahan));

// Penduduk: bagi target kecamatan secara proporsional terhadap luas x bobot kepadatan x derau.
for (const kec of Object.keys(KEC_POP)) {
  const members = regions.filter((r) => r.kecamatan === kec);
  const w = members.map((r) => r.areaKm2 * (DENSITY_WEIGHT[r.kelurahan] ?? 1) * logNoise(0.14));
  const wSum = w.reduce((a, b) => a + b, 0);
  members.forEach((r, i) => {
    r.pop = Math.round((KEC_POP[kec] * w[i]) / wSum / 10) * 10;
  });
}
const latMin = Math.min(...regions.map((r) => r.lat));
const latMax = Math.max(...regions.map((r) => r.lat));
for (const r of regions) {
  r.southness = (latMax - r.lat) / (latMax - latMin); // 0 = paling utara, 1 = paling selatan
  r.rainFactor = 0.88 + 0.3 * r.southness; // selatan (arah Bogor) lebih basah
  r.floodProne = FLOOD_PRONE[r.kelurahan] ?? 0.08;
  const density = r.pop / r.areaKm2;
  r.vulnDbd = logNoise(0.22) * (0.9 + Math.min(0.3, density / 100000));
  r.vulnMun = logNoise(0.18);
  r.vulnFlu = logNoise(0.15);
}

// ---------- Curah hujan ------------------------------------------------------
// Normal bulanan (mm) bergaya Jakarta: total ~1.890 mm/tahun.
const MONTHLY_NORMAL = [380, 310, 220, 150, 110, 70, 55, 45, 60, 110, 150, 230];
const MEAN_WEEKLY_RAIN = MONTHLY_NORMAL.reduce((a, b) => a + b, 0) / 52.18; // ~36 mm

function climWeekly(mid) {
  // Interpolasi linear antar titik tengah bulan, lalu ubah ke mm/minggu.
  const m = mid.getUTCMonth();
  const dim = new Date(Date.UTC(mid.getUTCFullYear(), m + 1, 0)).getUTCDate();
  const pos = (mid.getUTCDate() - 0.5) / dim - 0.5; // -0.5..0.5 relatif titik tengah bulan
  const other = pos < 0 ? (m + 11) % 12 : (m + 1) % 12;
  const t = Math.abs(pos);
  return ((1 - t) * MONTHLY_NORMAL[m] + t * MONTHLY_NORMAL[other]) / 4.345;
}

// Anomali antar-periode (cerita iklim sintetis): [mulai, selesai, faktor]
const ANOMALY = [
  ['2024-01-01', '2024-04-28', 0.92], // sisa El Nino: sedikit di bawah normal
  ['2024-04-29', '2024-10-27', 0.82], // kemarau kering
  ['2024-10-28', '2024-12-29', 1.15],
  ['2024-12-30', '2025-03-30', 1.25], // musim hujan basah (banjir besar awal Maret 2025)
  ['2025-03-31', '2025-06-29', 1.1],
  ['2025-06-30', '2025-09-28', 1.3], // "kemarau basah"
  ['2025-09-29', '2025-12-28', 1.0],
  ['2025-12-29', '2026-03-29', 0.95],
  ['2026-03-30', '2026-08-30', 0.8],
  ['2026-08-31', '2026-09-27', 1.5], // awal musim hujan maju
  ['2026-09-28', '2026-11-01', 1.55], // Oktober 2026 di atas normal
];
const anomalyOf = (iso) => (ANOMALY.find(([a, b]) => iso >= a && iso <= b) ?? [0, 0, 1])[2];

// Kejadian hujan ekstrem tingkat kota (mm/minggu, rata-rata kota) — pemicu genangan.
const EXTREME_WEEKS = {
  '2024-02-26': 150,
  '2025-01-27': 205,
  '2025-03-03': 255,
  '2025-07-07': 120,
  '2026-01-19': 185,
  '2026-10-12': 168,
  '2026-10-19': 92,
};

const cityRain = weeks.map((w) => {
  if (EXTREME_WEEKS[w.date]) return EXTREME_WEEKS[w.date];
  return climWeekly(w.mid) * anomalyOf(w.date) * logNoise(0.5);
});

const kecNames = Object.keys(KEC_POP);
const rain = new Map(); // id -> number[]
for (const r of regions) rain.set(r.id, new Array(N_WEEKS).fill(0));
for (let t = 0; t < N_WEEKS; t++) {
  const kecShock = Object.fromEntries(kecNames.map((k) => [k, logNoise(0.2)]));
  for (const r of regions) {
    const v = cityRain[t] * r.rainFactor * kecShock[r.kecamatan] * logNoise(0.12);
    rain.get(r.id)[t] = Math.round(v * 10) / 10;
  }
}

// ---------- Kejadian lokal (klaster) ----------------------------------------
// Pengali naik-turun halus selama `dur` minggu sejak `start`.
const CLUSTERS = {
  dbd: [
    { start: '2024-03-18', dur: 9, mult: 2.3, kel: ['Pulo Gebang', 'Penggilingan', 'Cakung Timur', 'Jatinegara'] },
    { start: '2025-02-10', dur: 8, mult: 2.1, kel: ['Lubang Buaya', 'Ceger', 'Bambu Apus', 'Cipayung'] },
    { start: '2026-02-02', dur: 7, mult: 2.0, kel: ['Klender', 'Pondok Bambu', 'Duren Sawit', 'Malaka Jaya'] },
    { start: '2026-10-05', dur: 9, mult: 3.0, kel: ['Cibubur', 'Kelapa Dua Wetan', 'Ciracas', 'Susukan'] },
    { start: '2026-10-12', dur: 8, mult: 2.2, kel: ['Kalisari', 'Pekayon', 'Munjul'] },
  ],
  muntaber: [
    { start: '2025-08-18', dur: 4, mult: 2.4, kel: ['Rawa Terate', 'Jatinegara'] },
    { start: '2026-06-08', dur: 3, mult: 2.0, kel: ['Pisangan Timur', 'Cipinang'] },
  ],
  influenza: [
    { start: '2025-06-16', dur: 5, mult: 1.7, kel: ['Rawamangun', 'Jati', 'Kayu Putih', 'Pisangan Timur'] },
    { start: '2026-10-12', dur: 5, mult: 1.9, kel: ['Rawamangun', 'Jati', 'Kayu Putih', 'Utan Kayu Utara'] },
  ],
};
function clusterMult(disease, kelurahan, t) {
  let m = 1;
  for (const c of CLUSTERS[disease]) {
    if (!c.kel.includes(kelurahan)) continue;
    const s = weekIndexOf(c.start);
    if (t < s || t >= s + c.dur) continue;
    const phase = (t - s + 0.5) / c.dur; // 0..1
    const env = Math.min(1, phase * 3, (1 - phase) * 2.2 + 0.25); // naik cepat, turun lebih landai
    m *= 1 + (c.mult - 1) * Math.max(0, env);
  }
  return m;
}

// ---------- Model penyakit ---------------------------------------------------
const lagged = (arr, t, lags, weights) => {
  let s = 0;
  for (let i = 0; i < lags.length; i++) {
    const idx = t - lags[i];
    // Sebelum awal data: pakai klimatologi minggu tersebut (hindari artefak awal deret).
    const v = idx >= 0 ? arr[idx] : climWeekly(new Date(weeks[0].mid.getTime() + idx * 7 * DAY)) * 0.92;
    s += weights[i] * v;
  }
  return s;
};
const DBD_YEAR = { 2024: 1.3, 2025: 0.85, 2026: 1.0 };
const FLU_YEAR = { 2024: 0.95, 2025: 1.1, 2026: 1.0 };

function midYearWave(mid) {
  // Gelombang kecil influenza pertengahan tahun (Juni-Juli).
  const doy = (mid - Date.UTC(mid.getUTCFullYear(), 0, 1)) / DAY;
  return Math.exp(-Math.pow((doy - 180) / 24, 2));
}
function drySeasonBump(mid) {
  // Muntaber sedikit naik saat puncak kemarau (ketersediaan air bersih menurun).
  const doy = (mid - Date.UTC(mid.getUTCFullYear(), 0, 1)) / DAY;
  return Math.exp(-Math.pow((doy - 235) / 28, 2));
}

const cases = { dbd: new Map(), muntaber: new Map(), influenza: new Map() };
for (const r of regions) {
  const rr = rain.get(r.id);
  const p = r.pop / 100000;
  const dbd = [];
  const mun = [];
  const flu = [];
  for (let t = 0; t < N_WEEKS; t++) {
    const w = weeks[t];
    const year = w.mid.getUTCFullYear();

    // --- DBD: hujan 4-9 minggu lalu (bobot puncak di minggu ke-6) ---
    const gDbd = lagged(rr, t, [4, 5, 6, 7, 8, 9], [0.1, 0.2, 0.25, 0.2, 0.15, 0.1]) / MEAN_WEEKLY_RAIN;
    let lamDbd = p * 2.2 * (0.22 + Math.pow(gDbd, 1.3)) * r.vulnDbd * DBD_YEAR[year] * clusterMult('dbd', r.kelurahan, t);
    if (t >= 2) lamDbd = 0.62 * lamDbd + 0.38 * ((dbd[t - 1] + dbd[t - 2]) / 2); // penularan lokal -> kasus mengelompok
    dbd.push(randCases(lamDbd, 7));

    // --- Muntaber: hujan ekstrem 0-2 minggu lalu x kerawanan genangan ---
    const excess = (lag) => {
      const idx = t - lag;
      return idx >= 0 ? Math.max(0, rr[idx] - 85) / 50 : 0;
    };
    const flood = r.floodProne * (0.15 * excess(0) + 0.55 * excess(1) + 0.3 * excess(2));
    const wet = 0.12 * Math.sqrt(lagged(rr, t, [1, 2], [0.6, 0.4]) / MEAN_WEEKLY_RAIN);
    const lamMun = p * 5.5 * (0.78 + wet + 0.22 * drySeasonBump(w.mid) + flood) * r.vulnMun * clusterMult('muntaber', r.kelurahan, t);
    mun.push(randCases(lamMun, 9));

    // --- Influenza: musim hujan (jeda 1-3 minggu) + gelombang pertengahan tahun ---
    const gFlu = lagged(rr, t, [1, 2, 3], [0.3, 0.4, 0.3]) / MEAN_WEEKLY_RAIN;
    let lamFlu = p * 7 * (0.5 + 0.48 * Math.pow(Math.min(gFlu, 1.7), 0.8) + 0.4 * midYearWave(w.mid)) * r.vulnFlu * FLU_YEAR[year] * clusterMult('influenza', r.kelurahan, t);
    if (t >= 1) lamFlu = 0.68 * lamFlu + 0.32 * flu[t - 1];
    flu.push(randCases(lamFlu, 10));
  }
  cases.dbd.set(r.id, dbd);
  cases.muntaber.set(r.id, mun);
  cases.influenza.set(r.id, flu);
}

// ---------- Tulis CSV --------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });

const wilayahRows = ['id_kelurahan,kota,kecamatan,kelurahan,penduduk,luas_km2,lat,lon'];
for (const r of regions) {
  wilayahRows.push([r.id, KOTA, r.kecamatan, r.kelurahan, r.pop, r.areaKm2.toFixed(3), r.lat.toFixed(5), r.lon.toFixed(5)].join(','));
}
writeFileSync(join(OUT_DIR, 'wilayah_jakarta_timur.csv'), wilayahRows.join('\n') + '\n');

const tsRows = ['tanggal,tahun,minggu_epi,kota,kecamatan,kelurahan,curah_hujan_mm,insiden_dbd,insiden_muntaber,insiden_influenza'];
for (let t = 0; t < N_WEEKS; t++) {
  const w = weeks[t];
  for (const r of regions) {
    tsRows.push(
      [
        w.date,
        w.isoYear,
        w.isoWeek,
        KOTA,
        r.kecamatan,
        r.kelurahan,
        rain.get(r.id)[t].toFixed(1),
        cases.dbd.get(r.id)[t],
        cases.muntaber.get(r.id)[t],
        cases.influenza.get(r.id)[t],
      ].join(','),
    );
  }
}
writeFileSync(join(OUT_DIR, 'ews_jakarta_timur_mingguan.csv'), tsRows.join('\n') + '\n');

// ---------- Ringkasan ke konsol ---------------------------------------------
const sumAt = (m, t) => regions.reduce((s, r) => s + m.get(r.id)[t], 0);
const totalPop = regions.reduce((s, r) => s + r.pop, 0);
console.log(`Kelurahan: ${regions.length} | Minggu: ${N_WEEKS} (${weeks[0].date} s.d. ${weeks[N_WEEKS - 1].date}) | Baris: ${tsRows.length - 1}`);
console.log(`Total penduduk (dummy): ${totalPop.toLocaleString('id-ID')}`);
for (const y of [2024, 2025, 2026]) {
  const idx = weeks.filter((w) => w.isoYear === y).map((w) => w.idx);
  const tot = (m) => idx.reduce((s, t) => s + sumAt(m, t), 0);
  const rainMean = idx.reduce((s, t) => s + cityRain[t], 0);
  console.log(
    `${y}: hujan ${rainMean.toFixed(0)} mm (${idx.length} mgg) | DBD ${tot(cases.dbd)} | Muntaber ${tot(cases.muntaber)} | Influenza ${tot(cases.influenza)}`,
  );
}
