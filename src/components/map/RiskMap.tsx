'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapPinOff } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { CITY_NAME, DISEASES, LEVELS } from '@/lib/config';
import { assess, countByLevel } from '@/lib/engines/risk';
import { fmtInt, fmtRain, fmtWeekRange } from '@/lib/format';
import type { Assessment, Dataset, DiseaseId } from '@/types/ews';
import {
  bboxOf,
  GEO_ATTRIBUTION,
  loadKecamatanGeo,
  loadKelurahanGeo,
  outlinePoints,
  type Bbox,
  type KecamatanGeo,
  type KelurahanGeo,
  type KelurahanGeoProps,
} from './geo';
import { MapLegend } from './MapLegend';
import { MapTooltip } from './MapTooltip';
import { getIncidenceBreaks, metricColor, type MapMetric } from './scales';

export type { MapMetric } from './scales';

// MapLibre v6 memuat worker dari URL terpisah (berkasnya disalin ke /public saat postinstall).
if (typeof window !== 'undefined' && typeof maplibregl.setWorkerUrl === 'function') {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
}

export interface RiskMapProps {
  dataset: Dataset;
  disease: DiseaseId;
  weekIndex: number;
  /** Besaran yang diwarnai. Default 'level'. */
  metric?: MapMetric;
  /** Id kelurahan terpilih (garis tepi tebal). */
  selectedId?: string | null;
  /** Klik kelurahan -> id; klik area kosong -> null. */
  onSelect?: (id: string | null) => void;
  /** Bila diisi: peta memusat ke kecamatan itu dan kecamatan lain diredupkan. */
  focusKecamatanId?: string | null;
  /** Default true. false = pratinjau statis (tanpa geser/zoom/kontrol; tooltip tetap ada). */
  interactive?: boolean;
  /** Default true: legenda menumpang di kiri bawah. */
  showLegend?: boolean;
  /** Default true: peta dasar abu-abu redup di bawah koroplet. */
  showBasemap?: boolean;
  /** Ukuran ditentukan induk: komponen mengisi 100% lebar/tinggi (min-height bawaan 240px). */
  className?: string;
  ariaLabel?: string;
}

// ---------------------------------------------------------------------------
// Konstanta peta
// ---------------------------------------------------------------------------
const SRC_BASE = 'sm-basemap';
const SRC_KEL = 'sm-kelurahan';
const SRC_KEC = 'sm-kecamatan';
const L_BASE = 'sm-basemap';
const L_FILL = 'sm-kel-fill';

const BASEMAP_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const BASEMAP_ATTRIBUTION_FULL = 'Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community';

/** Dipakai sebelum GeoJSON selesai dihitung kotak pembatasnya. */
const CITY_BBOX_FALLBACK: Bbox = [106.838, -6.374, 106.974, -6.151];
const MAX_ZOOM = 15;
const CITY_FIT_MAX_ZOOM = 12.5;
const FOCUS_FIT_MAX_ZOOM = 13.5;
/** Seberapa jauh pengguna boleh memperkecil dari tampilan "seluruh kota". */
const MIN_ZOOM_SLACK = 0.6;
/** Di bawah zoom ini label kecamatan pasti bertumpuk -> disembunyikan semua. */
const LABEL_MIN_ZOOM = 9.5;
/** Pratinjau statis yang lebih sempit dari ini tidak diberi label kecamatan. */
const LABEL_MIN_WIDTH_STATIC = 360;
const WORLD_SIZE = 512;
/** Pecahan tapak legenda yang dicoba sebagai geseran saat peta menimpa legenda. */
const LEGEND_SHIFT_STEPS = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];

const LOCALE_ID: Record<string, string> = {
  'Map.Title': 'Peta',
  'NavigationControl.ZoomIn': 'Perbesar',
  'NavigationControl.ZoomOut': 'Perkecil',
  'CooperativeGesturesHandler.WindowsHelpText': 'Tahan Ctrl sambil menggulir untuk memperbesar peta',
  'CooperativeGesturesHandler.MacHelpText': 'Tahan ⌘ sambil menggulir untuk memperbesar peta',
  'CooperativeGesturesHandler.MobileHelpText': 'Gunakan dua jari untuk menggeser peta',
};

type Phase = 'loading' | 'ready' | 'unsupported' | 'geo-error';

interface GeoData {
  kel: KelurahanGeo;
  kec: KecamatanGeo;
}

interface Camera {
  center: maplibregl.LngLat;
  zoom: number;
}

interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface LabelEntry {
  id: string;
  lngLat: maplibregl.LngLat;
  marker: maplibregl.Marker;
  inner: HTMLSpanElement;
  /** Setengah lebar/tinggi kotak label (px), diukur sekali lalu disimpan. */
  hw: number;
  hh: number;
  priority: number;
}

/** Perintah imperatif ke peta yang sedang hidup (null selama belum ada / sudah dibongkar). */
interface MapApi {
  /** Hitung ulang bingkai & batas zoom; `moveCamera=false` membiarkan kamera pengguna. */
  fit: (animate: boolean, moveCamera?: boolean) => void;
  applyColors: (colors: Record<string, string>) => void;
  applySelected: (id: string | null) => void;
  applyFocus: (id: string | null) => void;
  setInteractive: (value: boolean) => void;
  setBasemap: (value: boolean) => void;
  refreshLabels: () => void;
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function featureId(f: maplibregl.MapGeoJSONFeature | undefined): string | null {
  // `properties` bertipe longgar di MapLibre ({[k]: any}); persempit di sini saja.
  const id: unknown = f?.properties?.id;
  return typeof id === 'string' ? id : null;
}

function buildStyle(geo: GeoData, showBasemap: boolean): maplibregl.StyleSpecification {
  const bg = cssVar('--bg', '#f2f5f4');
  const neutral = cssVar('--sunken', '#e8edeb');
  const ink = cssVar('--ink', '#10201e');
  const kecLine = cssVar('--brand-strong', '#073f46');

  // Status per fitur (warna isian, hover, terpilih, redup) dikirim lewat feature-state:
  // mengganti minggu/penyakit tidak memicu pemuatan ulang sumber maupun tata ulang layer.
  const flag = (key: string): maplibregl.ExpressionSpecification => ['boolean', ['feature-state', key], false];

  return {
    version: 8,
    // Tanpa `glyphs`/`sprite`: tidak ada layer simbol, sehingga peta utuh walau luring.
    sources: {
      [SRC_BASE]: {
        type: 'raster',
        tiles: [BASEMAP_TILES],
        tileSize: 256,
        maxzoom: 16,
        attribution: `Peta dasar © ${BASEMAP_ATTRIBUTION_FULL}`,
      },
      [SRC_KEL]: { type: 'geojson', data: geo.kel, promoteId: 'id', attribution: GEO_ATTRIBUTION },
      [SRC_KEC]: { type: 'geojson', data: geo.kec, promoteId: 'kecamatanId' },
    },
    layers: [
      { id: 'sm-background', type: 'background', paint: { 'background-color': bg } },
      {
        id: L_BASE,
        type: 'raster',
        source: SRC_BASE,
        layout: { visibility: showBasemap ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.55, 'raster-saturation': -0.3, 'raster-fade-duration': 200 },
      },
      {
        id: L_FILL,
        type: 'fill',
        source: SRC_KEL,
        paint: {
          'fill-color': ['to-color', ['feature-state', 'fill'], neutral],
          'fill-opacity': ['case', flag('dim'), 0.25, 0.85],
        },
      },
      {
        id: 'sm-kel-line',
        type: 'line',
        source: SRC_KEL,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 0.75, 'line-opacity': 0.9 },
      },
      {
        id: 'sm-kec-line',
        type: 'line',
        source: SRC_KEC,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': kecLine,
          'line-width': ['case', flag('focus'), 2.5, 1.5],
          'line-opacity': ['case', flag('dim'), 0.3, 0.9],
        },
      },
      {
        id: 'sm-kel-hover',
        type: 'line',
        source: SRC_KEL,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': ink, 'line-width': 1.5, 'line-opacity': ['case', flag('hover'), 0.9, 0] },
      },
      {
        id: 'sm-kel-selected-casing',
        type: 'line',
        source: SRC_KEL,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 5.5, 'line-opacity': ['case', flag('selected'), 1, 0] },
      },
      {
        id: 'sm-kel-selected',
        type: 'line',
        source: SRC_KEL,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': ink, 'line-width': 2.5, 'line-opacity': ['case', flag('selected'), 1, 0] },
      },
    ],
  };
}

function createLabelElement(name: string): { el: HTMLDivElement; inner: HTMLSpanElement } {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.pointerEvents = 'none';
  const inner = document.createElement('span');
  inner.textContent = name;
  Object.assign(inner.style, {
    display: 'block',
    width: 'min-content', // satu kata per baris: tapak label sesempit mungkin
    // .maplibregl-map menimpa font induk, jadi keluarga huruf harus dipasang eksplisit.
    fontFamily: 'var(--font-sans)',
    fontSize: '10.5px',
    lineHeight: '1.15',
    fontWeight: '600',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'var(--ink)',
    textShadow: '0 0 2px #fff, 0 0 2px #fff, 1px 0 0 #fff, -1px 0 0 #fff, 0 1px 0 #fff, 0 -1px 0 #fff',
    userSelect: 'none',
    opacity: '0',
    transition: 'opacity 0.15s',
  } satisfies Partial<CSSStyleDeclaration>);
  el.appendChild(inner);
  return { el, inner };
}

function defaultAriaLabel(metric: MapMetric, disease: DiseaseId, range: string): string {
  const what =
    metric === 'incidence'
      ? `insidensi ${DISEASES[disease].short}`
      : metric === 'rain'
        ? 'curah hujan'
        : `level peringatan ${DISEASES[disease].short}`;
  return `Peta ${what} per kelurahan di ${CITY_NAME}, minggu ${range}`;
}

/**
 * Peta koroplet 65 kelurahan Jakarta Timur (MapLibre). Mengisi 100% lebar & tinggi induknya.
 * Warna isian diperbarui lewat feature-state, jadi aman dianimasikan antarminggu.
 */
export function RiskMap({
  dataset,
  disease,
  weekIndex,
  metric = 'level',
  selectedId = null,
  onSelect,
  focusKecamatanId = null,
  interactive = true,
  showLegend = true,
  showBasemap = true,
  className,
  ariaLabel,
}: RiskMapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<MapApi | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const hoverIdRef = useRef<string | null>(null);

  const [geo, setGeo] = useState<GeoData | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [attempt, setAttempt] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // --- Data turunan (murah: assess() di-cache per dataset) ---
  const week = Math.min(Math.max(Math.round(weekIndex), 0), dataset.latestWeek);

  const assessments = useMemo(() => {
    const byId = new Map<string, Assessment>();
    for (const id of dataset.kelurahanIds) byId.set(id, assess(dataset, id, disease, week));
    return byId;
  }, [dataset, disease, week]);

  const colors = useMemo(() => {
    const breaks = metric === 'incidence' ? getIncidenceBreaks(dataset, disease) : [];
    const out: Record<string, string> = {};
    for (const [id, a] of assessments) out[id] = metricColor(metric, a, breaks);
    return out;
  }, [assessments, dataset, disease, metric]);

  const counts = useMemo(() => countByLevel([...assessments.values()]), [assessments]);

  /** Daftar untuk pembaca layar: level tertinggi dulu, lalu abjad. */
  const srRows = useMemo(
    () =>
      [...assessments.values()].sort(
        (a, b) =>
          LEVELS[b.level].rank - LEVELS[a.level].rank ||
          dataset.regions[a.regionId].name.localeCompare(dataset.regions[b.regionId].name, 'id'),
      ),
    [assessments, dataset],
  );

  const geoProps = useMemo(() => {
    const byId = new Map<string, KelurahanGeoProps>();
    if (geo) for (const f of geo.kel.features) byId.set(f.properties.id, f.properties);
    return byId;
  }, [geo]);

  // --- Nilai terbaru untuk handler peta (dibuat sekali, tidak boleh memegang props basi) ---
  const latest = useRef({ dataset, colors, selectedId, focusKecamatanId, interactive, showBasemap, onSelect });
  useEffect(() => {
    latest.current = { dataset, colors, selectedId, focusKecamatanId, interactive, showBasemap, onSelect };
  });

  const positionTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    const root = rootRef.current;
    const p = pointerRef.current;
    if (!tip || !root || !p) return;
    const W = root.clientWidth;
    const H = root.clientHeight;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const edge = 6;
    let x = p.x + 14;
    if (x + tw > W - edge) x = p.x - 14 - tw;
    x = Math.max(edge, Math.min(x, W - tw - edge));
    let y = p.y + 16;
    if (y + th > H - edge) y = p.y - 12 - th;
    y = Math.max(edge, Math.min(y, H - th - edge));
    tip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }, []);

  // --- 1. Muat batas wilayah (sekali per sesi; lihat geo.ts) ---
  useEffect(() => {
    let alive = true;
    Promise.all([loadKelurahanGeo(), loadKecamatanGeo()])
      .then(([kel, kec]) => {
        if (alive) setGeo({ kel, kec });
      })
      .catch(() => {
        if (alive) setPhase('geo-error');
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  // --- 2. Buat peta (sekali per GeoJSON). Aman untuk mount ganda StrictMode: pembersihan penuh. ---
  useEffect(() => {
    const container = containerRef.current;
    if (!geo || !container) return;

    const cityBbox = geo.kel.features.length > 0 ? bboxOf(geo.kel.features) : CITY_BBOX_FALLBACK;
    const kecBbox = new Map<string, Bbox>();
    const kecOutline = new Map<string, Float64Array>();
    for (const f of geo.kec.features) {
      kecBbox.set(f.properties.kecamatanId, bboxOf([f]));
      kecOutline.set(f.properties.kecamatanId, outlinePoints([f]));
    }
    const cityOutline = outlinePoints(geo.kec.features.length > 0 ? geo.kec.features : geo.kel.features);
    const kelIds = new Set(geo.kel.features.map((f) => f.properties.id));
    // Pusat kamera hanya boleh berada di dalam kotak ini (kotak kota, diperluas seperlunya oleh
    // fit() agar memuat pusat tampilan awal), sehingga kota tidak pernah hilang dari layar.
    const roam: Bbox = [...cityBbox];
    let minZoomLimit = 0;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: buildStyle(geo, latest.current.showBasemap),
        bounds: [
          [cityBbox[0], cityBbox[1]],
          [cityBbox[2], cityBbox[3]],
        ],
        fitBoundsOptions: { padding: 16 },
        maxZoom: MAX_ZOOM,
        attributionControl: false, // atribusi dirender sendiri agar selalu terlihat & berbahasa Indonesia
        trackResize: false, // ditangani ResizeObserver di bawah (resize -> paskan ulang)
        dragRotate: false,
        touchPitch: false,
        pitchWithRotate: false,
        maxPitch: 0,
        renderWorldCopies: false,
        locale: LOCALE_ID,
        transformConstrain: (lngLat, zoom) => ({
          center: new maplibregl.LngLat(
            Math.min(Math.max(lngLat.lng, roam[0]), roam[2]),
            Math.min(Math.max(lngLat.lat, roam[1]), roam[3]),
          ),
          // Fungsi ini menggantikan pembatas bawaan MapLibre, jadi rentang zoom dijaga di sini juga.
          zoom: Math.min(Math.max(zoom, minZoomLimit), MAX_ZOOM),
        }),
      });
    } catch {
      // WebGL tidak tersedia / gagal dibuat: tampilkan panel pengganti, jangan sampai aplikasi jatuh.
      setPhase('unsupported');
      return;
    }

    let disposed = false;
    let styleLoaded = false;
    let userMoved = false;
    let rafResize = 0;
    let rafLabels = 0;
    let nav: maplibregl.NavigationControl | null = null;
    let selectedApplied: string | null = null;
    const appliedColors = new Map<string, string>();
    const canvas = map.getCanvas();
    // Cincin fokus global digambar di luar elemen dan akan terpotong tepi kartu: tarik ke dalam.
    canvas.style.outlineOffset = '-3px';
    canvas.style.borderRadius = '0';

    // Ubin peta dasar yang gagal (luring) cukup diabaikan: koroplet tetap utuh di atas warna latar.
    map.on('error', (e) => {
      const sourceId: unknown = 'sourceId' in e ? e.sourceId : undefined;
      if (sourceId === SRC_BASE) return;
      console.warn('[RiskMap]', e.error);
    });

    // ---- Label kecamatan (Marker HTML; tanpa glyph eksternal) ----
    const labels: LabelEntry[] = [];
    {
      const ds = latest.current.dataset;
      for (const f of geo.kec.features) {
        const id = f.properties.kecamatanId;
        const region = ds.regions[id];
        const box = kecBbox.get(id) ?? cityBbox;
        const lngLat = region
          ? new maplibregl.LngLat(region.lon, region.lat)
          : new maplibregl.LngLat((box[0] + box[2]) / 2, (box[1] + box[3]) / 2);
        const { el, inner } = createLabelElement(region?.name ?? f.properties.kecamatan);
        const marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
        labels.push({ id, lngLat, marker, inner, hw: 0, hh: 0, priority: region?.population ?? 0 });
      }
      labels.sort((a, b) => b.priority - a.priority);
    }

    const measureLabels = () => {
      for (const l of labels) {
        l.hw = l.inner.offsetWidth / 2 + 3;
        l.hh = l.inner.offsetHeight / 2 + 2;
      }
    };

    /** Tampilkan label yang tidak saling menimpa (prioritas: kecamatan fokus, lalu penduduk terbanyak). */
    const refreshLabels = () => {
      if (disposed) return;
      const { interactive: isInteractive, focusKecamatanId: focus } = latest.current;
      const hideAll =
        map.getZoom() < LABEL_MIN_ZOOM || (!isInteractive && container.clientWidth < LABEL_MIN_WIDTH_STATIC);
      const hasFocus = focus != null && kecBbox.has(focus);
      const ordered = hasFocus ? [...labels].sort((a, b) => Number(b.id === focus) - Number(a.id === focus)) : labels;
      const placed: { x: number; y: number; hw: number; hh: number }[] = [];
      for (const l of ordered) {
        let show = !hideAll && l.hw > 3;
        if (show) {
          const p = map.project(l.lngLat);
          show = !placed.some((q) => Math.abs(q.x - p.x) < q.hw + l.hw && Math.abs(q.y - p.y) < q.hh + l.hh);
          if (show) placed.push({ x: p.x, y: p.y, hw: l.hw, hh: l.hh });
        }
        l.inner.style.opacity = !show ? '0' : hasFocus && l.id !== focus ? '0.45' : '1';
      }
    };

    const scheduleLabels = () => {
      cancelAnimationFrame(rafLabels);
      rafLabels = requestAnimationFrame(refreshLabels);
    };

    // ---- Kamera: paskan ke kota / kecamatan fokus, dengan ruang untuk legenda ----
    const toCamera = (cam: ReturnType<maplibregl.Map['cameraForBounds']>): Camera | null =>
      cam?.center != null && typeof cam.zoom === 'number'
        ? { center: maplibregl.LngLat.convert(cam.center), zoom: cam.zoom }
        : null;

    const fit = (animate: boolean, moveCamera = true) => {
      if (disposed) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 80 || h < 80) return;

      const base = Math.round(Math.min(28, Math.max(10, Math.min(w, h) * 0.05)));
      // Sedikit ruang ekstra di bawah untuk baris atribusi.
      const uniform: Padding = { top: base, right: base, bottom: base + 10, left: base };

      // Tapak legenda (kiri bawah), diukur dari DOM.
      let legendW = 0;
      let legendH = 0;
      const legendEl = legendRef.current;
      const root = rootRef.current;
      if (legendEl && root) {
        const lr = legendEl.getBoundingClientRect();
        const rr = root.getBoundingClientRect();
        legendW = lr.right - rr.left + 10;
        legendH = rr.bottom - lr.top + 10;
      }

      const cameraFor = (bbox: Bbox, outline: Float64Array, maxZoom: number): Camera | null => {
        const bounds: [[number, number], [number, number]] = [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ];
        const tryPadding = (padding: Padding): Camera | null =>
          w - padding.left - padding.right < 60 || h - padding.top - padding.bottom < 60
            ? null
            : toCamera(map.cameraForBounds(bounds, { padding, maxZoom, bearing: 0, pitch: 0 }));

        const plain = tryPadding(uniform);
        if (legendW === 0 || !plain) return plain;

        // Apakah ada titik batas wilayah yang jatuh di bawah legenda pada kamera ini?
        const coversLegend = (cam: Camera): boolean => {
          const world = WORLD_SIZE * 2 ** cam.zoom;
          const c = maplibregl.MercatorCoordinate.fromLngLat(cam.center);
          for (let i = 0; i < outline.length; i += 2) {
            if ((outline[i] - c.x) * world + w / 2 >= legendW) continue;
            if ((outline[i + 1] - c.y) * world + h / 2 > h - legendH) return true;
          }
          return false;
        };
        if (!coversLegend(plain)) return plain;

        // Menimpa: coba geser ke kanan dan/atau ke atas secara bertahap, lalu ambil susunan
        // bebas-tumpang-tindih yang menyisakan peta paling besar (geseran terkecil menang seri).
        let best: Camera | null = null;
        for (const fx of LEGEND_SHIFT_STEPS) {
          for (const fy of LEGEND_SHIFT_STEPS) {
            if (fx === 0 && fy === 0) continue;
            const cam = tryPadding({
              ...uniform,
              left: Math.max(uniform.left, legendW * fx),
              bottom: Math.max(uniform.bottom, legendH * fy),
            });
            if (!cam || coversLegend(cam)) continue;
            if (!best || cam.zoom > best.zoom + 0.005) best = cam;
          }
        }
        return best ?? plain;
      };

      const cityCam = cameraFor(cityBbox, cityOutline, CITY_FIT_MAX_ZOOM);
      if (!cityCam) return;

      // Batas zoom & area geser mengikuti tampilan "seluruh kota" agar pengguna tidak tersesat.
      roam[0] = Math.min(cityBbox[0], cityCam.center.lng);
      roam[1] = Math.min(cityBbox[1], cityCam.center.lat);
      roam[2] = Math.max(cityBbox[2], cityCam.center.lng);
      roam[3] = Math.max(cityBbox[3], cityCam.center.lat);
      minZoomLimit = Math.max(0, cityCam.zoom - MIN_ZOOM_SLACK);
      map.setMinZoom(minZoomLimit);
      if (!moveCamera) return;

      const focus = latest.current.focusKecamatanId;
      const focusBox = focus != null ? kecBbox.get(focus) : undefined;
      const focusOutline = focus != null ? kecOutline.get(focus) : undefined;
      const target = (focusBox && focusOutline && cameraFor(focusBox, focusOutline, FOCUS_FIT_MAX_ZOOM)) || cityCam;
      // easeTo menghormati prefers-reduced-motion (tanpa `essential`).
      if (animate) map.easeTo({ center: target.center, zoom: target.zoom, duration: 650 });
      else map.jumpTo({ center: target.center, zoom: target.zoom });
    };

    // ---- Status per fitur ----
    const applyColors = (next: Record<string, string>) => {
      if (!styleLoaded) return;
      for (const id of kelIds) {
        const color = next[id];
        if (appliedColors.get(id) === color) continue;
        if (color === undefined) {
          map.removeFeatureState({ source: SRC_KEL, id }, 'fill');
          appliedColors.delete(id);
        } else {
          map.setFeatureState({ source: SRC_KEL, id }, { fill: color });
          appliedColors.set(id, color);
        }
      }
    };

    const applySelected = (id: string | null) => {
      if (!styleLoaded) return;
      const next = id != null && kelIds.has(id) ? id : null;
      if (next === selectedApplied) return;
      if (selectedApplied) map.setFeatureState({ source: SRC_KEL, id: selectedApplied }, { selected: false });
      if (next) map.setFeatureState({ source: SRC_KEL, id: next }, { selected: true });
      selectedApplied = next;
    };

    const applyFocus = (id: string | null) => {
      if (!styleLoaded) return;
      const focus = id != null && kecBbox.has(id) ? id : null;
      for (const f of geo.kel.features) {
        const dim = focus != null && f.properties.kecamatanId !== focus;
        map.setFeatureState({ source: SRC_KEL, id: f.properties.id }, { dim });
      }
      for (const kecId of kecBbox.keys()) {
        map.setFeatureState({ source: SRC_KEC, id: kecId }, { focus: kecId === focus, dim: focus != null && kecId !== focus });
      }
    };

    const setHover = (id: string | null, point?: { x: number; y: number }) => {
      const prev = hoverIdRef.current;
      if (prev !== id) {
        if (styleLoaded) {
          if (prev) map.setFeatureState({ source: SRC_KEL, id: prev }, { hover: false });
          if (id) map.setFeatureState({ source: SRC_KEL, id }, { hover: true });
        }
        hoverIdRef.current = id;
        setHoverId(id);
      }
      if (point) {
        pointerRef.current = { x: point.x, y: point.y };
        positionTooltip();
      }
      const idle = latest.current.interactive ? '' : 'default';
      canvas.style.cursor = id && latest.current.onSelect ? 'pointer' : idle;
    };

    const setInteractive = (value: boolean) => {
      if (value) {
        map.scrollZoom.enable();
        map.boxZoom.enable();
        map.dragPan.enable();
        map.keyboard.enable();
        map.doubleClickZoom.enable();
        map.touchZoomRotate.enable();
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        // Gulir halaman tidak dibajak: zoom butuh Ctrl/⌘, geser di layar sentuh butuh dua jari.
        map.cooperativeGestures.enable();
        if (!nav) {
          nav = new maplibregl.NavigationControl({ showCompass: false });
          map.addControl(nav, 'top-right');
        }
      } else {
        map.cooperativeGestures.disable();
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.dragPan.disable();
        map.keyboard.disable();
        map.doubleClickZoom.disable();
        map.touchZoomRotate.disable();
        if (nav) {
          map.removeControl(nav);
          nav = null;
        }
      }
      // Pratinjau statis tidak perlu menjadi perhentian Tab.
      canvas.tabIndex = value ? 0 : -1;
      canvas.style.cursor = value ? '' : 'default';
    };

    const setBasemap = (value: boolean) => {
      if (styleLoaded) map.setLayoutProperty(L_BASE, 'visibility', value ? 'visible' : 'none');
    };

    // ---- Peristiwa ----
    map.on('mousemove', L_FILL, (e) => setHover(featureId(e.features?.[0]), e.point));
    map.on('mouseleave', L_FILL, () => setHover(null));
    map.on('dragstart', () => setHover(null));
    map.on('click', (e) => {
      if (!styleLoaded) return;
      const id = featureId(map.queryRenderedFeatures(e.point, { layers: [L_FILL] })[0]);
      // Di layar sentuh tidak ada hover: ketukan sekaligus menampilkan info yang sama.
      setHover(id, e.point);
      latest.current.onSelect?.(id);
    });
    map.on('movestart', (e) => {
      // Hanya gerakan dari pengguna (bukan paskan-ulang terprogram) yang "mengunci" kamera.
      if ('originalEvent' in e && e.originalEvent) userMoved = true;
    });
    map.on('zoom', scheduleLabels);

    map.once('style.load', () => {
      if (disposed) return;
      styleLoaded = true;
      const now = latest.current;
      setBasemap(now.showBasemap);
      applyColors(now.colors);
      applySelected(now.selectedId);
      applyFocus(now.focusKecamatanId);
      measureLabels();
      refreshLabels();
      setPhase('ready');
    });

    setInteractive(latest.current.interactive);
    fit(false);

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafResize);
      rafResize = requestAnimationFrame(() => {
        if (disposed) return;
        map.resize();
        fit(false, !userMoved);
        measureLabels();
        refreshLabels();
      });
    });
    observer.observe(container);

    // Lebar label berubah setelah font web selesai dimuat.
    void document.fonts?.ready.then(() => {
      if (disposed) return;
      measureLabels();
      refreshLabels();
    });

    apiRef.current = {
      fit: (animate, moveCamera = true) => {
        if (moveCamera) userMoved = false;
        fit(animate, moveCamera);
      },
      applyColors,
      applySelected,
      applyFocus,
      setInteractive,
      setBasemap,
      refreshLabels,
    };

    return () => {
      disposed = true;
      apiRef.current = null;
      hoverIdRef.current = null;
      cancelAnimationFrame(rafResize);
      cancelAnimationFrame(rafLabels);
      observer.disconnect();
      for (const l of labels) l.marker.remove();
      map.remove();
    };
  }, [geo, positionTooltip]);

  // --- 3. Sinkronkan props -> peta (tanpa membuat ulang peta / sumber data) ---
  useEffect(() => {
    apiRef.current?.applyColors(colors);
  }, [colors, phase]);

  useEffect(() => {
    apiRef.current?.applySelected(selectedId);
  }, [selectedId, phase]);

  useEffect(() => {
    apiRef.current?.setBasemap(showBasemap);
  }, [showBasemap, phase]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.setInteractive(interactive);
    // Pratinjau statis tidak bisa digeser balik oleh pengguna: kembalikan ke bingkai penuh.
    if (!interactive) api.fit(false);
    api.refreshLabels();
  }, [interactive]);

  // Fokus kecamatan / ada-tidaknya legenda mengubah bingkai: paskan ulang dengan animasi.
  const framedOnce = useRef(false);
  useEffect(() => {
    const api = apiRef.current;
    if (!api || phase !== 'ready') return;
    api.applyFocus(focusKecamatanId);
    api.refreshLabels();
    // Bingkai awal sudah dipasang saat peta dibuat; animasikan hanya perubahan sesudahnya.
    if (framedOnce.current) api.fit(true);
    framedOnce.current = true;
  }, [focusKecamatanId, showLegend, phase]);

  // Ukuran tooltip berubah mengikuti isinya: posisikan ulang sebelum dicat.
  useLayoutEffect(() => {
    positionTooltip();
  }, [hoverId, disease, week, metric, positionTooltip]);

  const retry = () => {
    setPhase('loading');
    setAttempt((n) => n + 1);
  };

  const failed = phase === 'unsupported' || phase === 'geo-error';
  const hoverRegion = hoverId ? dataset.regions[hoverId] : undefined;
  const hoverGeo = hoverId ? geoProps.get(hoverId) : undefined;
  const range = fmtWeekRange(dataset.weeks[week]);
  const label = ariaLabel ?? defaultAriaLabel(metric, disease, range);

  return (
    <div
      ref={rootRef}
      className={twMerge('relative isolate h-full min-h-[240px] w-full overflow-hidden bg-bg', className)}
    >
      <div className="absolute inset-0">
        <div
          ref={containerRef}
          role={interactive ? 'application' : 'img'}
          aria-label={label}
          className="h-full w-full"
          style={{ visibility: failed ? 'hidden' : 'visible' }}
        />
      </div>

      {/* Isi peta untuk pembaca layar (kanvas WebGL tidak terbaca). */}
      <div className="sr-only">
        <p>
          {label}. Level peringatan {DISEASES[disease].short} tiap kelurahan:
        </p>
        <ul>
          {srRows.map((a) => {
            const region = dataset.regions[a.regionId];
            return (
              <li key={a.regionId}>
                {region.name}
                {region.kecamatan ? `, Kec. ${region.kecamatan}` : ''}: {LEVELS[a.level].label}, {fmtInt(a.cases)} kasus,
                curah hujan {fmtRain(a.rainThisWeek)}
                {a.regionId === selectedId ? ' (terpilih)' : ''}
              </li>
            );
          })}
        </ul>
      </div>

      {phase === 'loading' && (
        <div role="status" className="skeleton absolute inset-0 z-30 !rounded-none">
          <span className="sr-only">Memuat peta…</span>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-surface-2 p-6 text-center">
          <div className="max-w-[280px]">
            <MapPinOff aria-hidden className="mx-auto h-6 w-6 text-muted" strokeWidth={1.75} />
            <p className="mt-2 text-sm font-semibold text-ink">
              {phase === 'unsupported' ? 'Peta tidak dapat ditampilkan di perangkat ini' : 'Peta gagal dimuat'}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {phase === 'unsupported'
                ? 'Peramban atau perangkat Anda tidak mendukung WebGL. Data tiap kelurahan tetap dapat dibaca pada daftar dan grafik.'
                : 'Batas wilayah tidak berhasil diunduh. Periksa koneksi Anda, lalu coba lagi.'}
            </p>
            {phase === 'geo-error' && (
              <button type="button" onClick={retry} className="btn btn-ghost mt-3 !min-h-[36px] !text-[13px]">
                Coba lagi
              </button>
            )}
          </div>
        </div>
      )}

      {!failed && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
          {showLegend && (
            <div ref={legendRef} className="pointer-events-auto max-w-full">
              <MapLegend
                metric={metric}
                disease={disease}
                dataset={dataset}
                counts={metric === 'level' ? counts : undefined}
                orientation={metric === 'level' ? 'vertical' : 'horizontal'}
              />
            </div>
          )}
          <p
            className="pointer-events-auto ml-auto rounded-md px-1.5 py-0.5 text-[10px] leading-[14px] text-ink-2"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.82)' }}
          >
            {interactive ? (
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {GEO_ATTRIBUTION}
              </a>
            ) : (
              GEO_ATTRIBUTION
            )}
            {showBasemap && <span title={BASEMAP_ATTRIBUTION_FULL}> · Peta dasar © Esri</span>}
          </p>
        </div>
      )}

      {!failed && (
        <div
          ref={tooltipRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-20 w-max min-w-[176px] max-w-[min(248px,calc(100%-12px))] rounded-xl border border-line bg-surface px-3 py-2.5 shadow-pop"
          style={{ visibility: hoverId ? 'visible' : 'hidden' }}
        >
          {hoverId && (
            <MapTooltip
              name={hoverRegion?.name ?? hoverGeo?.kelurahan ?? hoverId}
              kecamatan={hoverRegion?.kecamatan ?? hoverGeo?.kecamatan}
              disease={disease}
              assessment={assessments.get(hoverId) ?? null}
            />
          )}
        </div>
      )}
    </div>
  );
}
