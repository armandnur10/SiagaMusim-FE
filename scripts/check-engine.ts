// Pemeriksaan cepat mesin risiko terhadap dataset dummy: `npx tsx scripts/check-engine.ts`
import { readFileSync } from 'node:fs';
import { buildDataset } from '../src/lib/data/dataset';
import { assess, assessMany, countByLevel } from '../src/lib/engines/risk';
import { forecast } from '../src/lib/engines/forecast';
import { lagCorrelation } from '../src/lib/engines/lag';
import { DISEASE_IDS } from '../src/lib/config';

const ds = buildDataset(
  readFileSync('public/data/ews_jakarta_timur_mingguan.csv', 'utf8'),
  readFileSync('public/data/wilayah_jakarta_timur.csv', 'utf8'),
);
console.log('weeks', ds.weeks.length, 'kel', ds.kelurahanIds.length, 'kec', ds.kecamatanIds.length, 'pop', ds.regions[ds.cityId].population);

for (const d of DISEASE_IDS) {
  console.log(`\n=== ${d} — sebaran level kelurahan (N/W/S/A) tiap 6 minggu + 6 minggu terakhir | kota`);
  const idxs = new Set<number>();
  for (let t = 6; t <= ds.latestWeek; t += 6) idxs.add(t);
  for (let t = ds.latestWeek - 5; t <= ds.latestWeek; t++) idxs.add(t);
  for (const t of [...idxs].sort((a, b) => a - b)) {
    const c = countByLevel(assessMany(ds, ds.kelurahanIds, d, t));
    const city = assess(ds, ds.cityId, d, t);
    console.log(
      ds.weeks[t].date,
      `N${String(c.normal).padStart(3)} W${String(c.waspada).padStart(3)} S${String(c.siaga).padStart(3)} A${String(c.awas).padStart(3)}`,
      `| kota: ${city.level.padEnd(8)} skor ${String(city.score).padStart(3)} kasus ${String(city.cases).padStart(4)} μ ${city.expected.toFixed(0).padStart(4)} amb ${city.threshold.toFixed(0).padStart(4)} sig ${JSON.stringify(city.signals)}`,
    );
  }
  let tot = { normal: 0, waspada: 0, siaga: 0, awas: 0 };
  for (let t = 0; t <= ds.latestWeek; t++) {
    const c = countByLevel(assessMany(ds, ds.kelurahanIds, d, t));
    for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] += c[k];
  }
  const all = tot.normal + tot.waspada + tot.siaga + tot.awas;
  console.log('semua waktu %:', Object.entries(tot).map(([k, v]) => `${k} ${((100 * v) / all).toFixed(1)}`).join(' | '));
  const lc = lagCorrelation(ds, ds.cityId, d);
  console.log('lag kota:', lc.points.map((p) => p.r.toFixed(2)).join(' '), '-> best', lc.bestLag);
  const f = forecast(ds, ds.cityId, d);
  console.log('proyeksi kota:', f.points.map((p) => `${p.expected.toFixed(0)} [${p.low.toFixed(0)}-${p.high.toFixed(0)}] amb ${p.threshold.toFixed(0)}`).join(' | '), f.direction, f.exceedsAtHorizon);
}

console.log('\n=== Top 8 kelurahan minggu terakhir per penyakit');
for (const d of DISEASE_IDS) {
  const list = assessMany(ds, ds.kelurahanIds, d).sort((a, b) => b.score - a.score).slice(0, 8);
  for (const a of list) {
    const f = forecast(ds, a.regionId, d);
    console.log(d.padEnd(9), ds.regions[a.regionId].name.padEnd(22), a.level.padEnd(8), 'skor', a.score, 'kasus', a.cases, 'amb', a.threshold.toFixed(1), JSON.stringify(a.signals), a.ruleNote ? 'RULE' : '', '| proy', f.points.map((p) => p.expected.toFixed(1)).join(','), '|', a.drivers.join('; '));
  }
}

// --- Ringkasan naratif ---
import { summarizeAll } from '../src/lib/summary';
console.log('\n=== Narasi minggu terakhir');
const sum = summarizeAll(ds);
for (const d of DISEASE_IDS) console.log(`[${sum[d].city.level}] ${sum[d].headline}\n    ${sum[d].detail}\n    counts ${JSON.stringify(sum[d].counts)}`);
for (const t of [20, 60, 100]) {
  const s2 = summarizeAll(ds, t);
  console.log('---', ds.weeks[t].date);
  for (const d of DISEASE_IDS) console.log(`[${s2[d].city.level}] ${s2[d].headline} ${s2[d].detail}`);
}
