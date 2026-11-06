import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { DATA_URLS } from '@/lib/config';

/** Properti fitur pada /geo/jakarta-timur-kelurahan.geojson. `id` = id kelurahan pada dataset. */
export interface KelurahanGeoProps {
  id: string;
  kelurahan: string;
  kecamatan: string;
  kecamatanId: string;
}

/** Properti fitur pada /geo/jakarta-timur-kecamatan.geojson. `kecamatanId` = id kecamatan pada dataset. */
export interface KecamatanGeoProps {
  kecamatanId: string;
  kecamatan: string;
}

export type KelurahanGeo = FeatureCollection<Polygon | MultiPolygon, KelurahanGeoProps>;
export type KecamatanGeo = FeatureCollection<Polygon | MultiPolygon, KecamatanGeoProps>;

/** [barat, selatan, timur, utara] dalam derajat. */
export type Bbox = [west: number, south: number, east: number, north: number];

/** Atribusi wajib untuk batas wilayah (ODbL). */
export const GEO_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

// Cache tingkat modul: tiap berkas hanya diunduh & diurai sekali per sesi tab.
const cache = new Map<string, Promise<unknown>>();

function loadGeo<T>(url: string): Promise<T> {
  let hit = cache.get(url) as Promise<T> | undefined;
  if (!hit) {
    hit = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Gagal memuat batas wilayah (HTTP ${res.status}).`);
        return res.json() as Promise<T>;
      })
      .catch((err: unknown) => {
        cache.delete(url); // izinkan coba lagi
        throw err;
      });
    cache.set(url, hit);
  }
  return hit;
}

/** Batas 65 kelurahan Jakarta Timur. */
export const loadKelurahanGeo = (): Promise<KelurahanGeo> => loadGeo<KelurahanGeo>(DATA_URLS.geoKelurahan);

/** Batas 10 kecamatan Jakarta Timur. */
export const loadKecamatanGeo = (): Promise<KecamatanGeo> => loadGeo<KecamatanGeo>(DATA_URLS.geoKecamatan);

function extend(box: Bbox, rings: Position[][]): void {
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < box[0]) box[0] = lon;
      if (lat < box[1]) box[1] = lat;
      if (lon > box[2]) box[2] = lon;
      if (lat > box[3]) box[3] = lat;
    }
  }
}

/** Kotak pembatas satu atau beberapa fitur poligon. */
export function bboxOf(features: Feature<Polygon | MultiPolygon>[]): Bbox {
  const box: Bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of features) {
    if (f.geometry.type === 'Polygon') extend(box, f.geometry.coordinates);
    else for (const poly of f.geometry.coordinates) extend(box, poly);
  }
  return box;
}

/**
 * Titik-titik cincin luar poligon dalam koordinat Web Mercator ternormalisasi (0..1),
 * berpasangan [x0, y0, x1, y1, …]. Dipakai peta untuk menguji tumpang-tindih dengan legenda.
 */
export function outlinePoints(features: Feature<Polygon | MultiPolygon>[]): Float64Array {
  const out: number[] = [];
  const push = (ring: Position[] | undefined) => {
    if (!ring) return;
    for (const [lon, lat] of ring) {
      out.push((lon + 180) / 360);
      out.push((180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360);
    }
  };
  for (const f of features) {
    if (f.geometry.type === 'Polygon') push(f.geometry.coordinates[0]);
    else for (const poly of f.geometry.coordinates) push(poly[0]);
  }
  return Float64Array.from(out);
}
