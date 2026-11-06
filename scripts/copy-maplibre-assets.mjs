// Menyalin aset MapLibre (CSS + web worker) ke /public agar versi worker
// selalu sama dengan versi paket yang terpasang. Dijalankan otomatis saat `npm install`.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'node_modules', 'maplibre-gl', 'dist');
const pub = join(root, 'public');
const files = ['maplibre-gl.css', 'maplibre-gl-worker.mjs'];

if (!existsSync(dist)) {
  console.warn('[copy-maplibre] maplibre-gl belum terpasang, dilewati.');
  process.exit(0);
}
mkdirSync(pub, { recursive: true });
for (const f of files) {
  const src = join(dist, f);
  if (!existsSync(src)) {
    console.warn(`[copy-maplibre] ${f} tidak ditemukan di paket, dilewati.`);
    continue;
  }
  copyFileSync(src, join(pub, f));
  console.log(`[copy-maplibre] ${f} -> public/`);
}
