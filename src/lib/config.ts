import type { AlertLevel, DiseaseId } from '@/types/ews';

export const APP_NAME = 'Siaga Musim';
export const APP_TAGLINE = 'Peringatan dini penyakit berbasis cuaca';
export const CITY_NAME = 'Jakarta Timur';
export const CITY_ID = 'kota-jakarta-timur';

export const DATA_URLS = {
  timeseries: '/data/ews_jakarta_timur_mingguan.csv',
  wilayah: '/data/wilayah_jakarta_timur.csv',
  geoKelurahan: '/geo/jakarta-timur-kelurahan.geojson',
  geoKecamatan: '/geo/jakarta-timur-kecamatan.geojson',
} as const;

// ---------------------------------------------------------------------------
// Penyakit
// ---------------------------------------------------------------------------
export interface DiseaseConfig {
  id: DiseaseId;
  /** Nama pendek untuk tab/legenda. */
  short: string;
  /** Nama lengkap. */
  name: string;
  /** Warna seri (tervalidasi aman buta warna terhadap dua penyakit lain). */
  color: string;
  colorSoft: string;
  /** Warna teks di atas colorSoft / permukaan putih. */
  colorText: string;
  /** Ramp sekuensial terang->gelap untuk peta angka insidensi. */
  ramp: string[];
  /** Jeda (minggu) hujan -> kasus yang dipakai mesin risiko, beserta bobotnya (jumlah = 1). */
  lags: number[];
  lagWeights: number[];
  /** Rentang jeda dalam kalimat. */
  lagLabel: string;
  /** Mekanisme epidemiologis singkat: mengapa hujan berpengaruh. */
  mechanism: string;
  /** Penularan dalam satu frasa. */
  transmission: string;
}

export const DISEASES: Record<DiseaseId, DiseaseConfig> = {
  dbd: {
    id: 'dbd',
    short: 'DBD',
    name: 'Demam Berdarah Dengue',
    color: '#B8356F',
    colorSoft: '#F8E4EE',
    colorText: '#8F2254',
    ramp: ['#F8E4EE', '#EDB9D2', '#DD86B0', '#C9558D', '#A82B63', '#7A1845'],
    lags: [4, 5, 6, 7, 8, 9],
    lagWeights: [0.1, 0.2, 0.25, 0.2, 0.15, 0.1],
    lagLabel: '4–9 minggu',
    mechanism:
      'Hujan meninggalkan genangan tempat nyamuk Aedes aegypti bertelur. Telur menjadi nyamuk dewasa dalam 1–2 minggu, virus berkembang di tubuh nyamuk 8–12 hari, lalu gejala muncul 4–7 hari setelah gigitan. Karena itu kasus biasanya baru naik 4–9 minggu setelah hujan.',
    transmission: 'Ditularkan nyamuk Aedes aegypti',
  },
  muntaber: {
    id: 'muntaber',
    short: 'Muntaber',
    name: 'Muntaber (Diare Akut)',
    color: '#0FA3A3',
    colorSoft: '#DDF3F3',
    colorText: '#0A6E6E',
    ramp: ['#DDF3F3', '#A9E0E0', '#6CC8C8', '#2FADAD', '#0B8585', '#075C5C'],
    lags: [0, 1, 2],
    lagWeights: [0.2, 0.5, 0.3],
    lagLabel: '0–2 minggu',
    mechanism:
      'Hujan sangat lebat dan genangan mencemari sumur, pipa, dan makanan dengan kuman dari saluran pembuangan. Masa inkubasinya pendek (1–3 hari), sehingga kasus naik cepat, 0–2 minggu setelah hujan ekstrem, terutama di kelurahan bantaran sungai.',
    transmission: 'Ditularkan lewat air dan makanan tercemar',
  },
  influenza: {
    id: 'influenza',
    short: 'Influenza',
    name: 'Influenza (Penyakit Serupa Flu)',
    color: '#6250D6',
    colorSoft: '#E8E5FA',
    colorText: '#4A3AA7',
    ramp: ['#E8E5FA', '#C6BFF3', '#9F94EA', '#7A6BDD', '#5442C0', '#382A8C'],
    lags: [1, 2, 3],
    lagWeights: [0.3, 0.4, 0.3],
    lagLabel: '1–3 minggu',
    mechanism:
      'Di daerah tropis, penularan influenza menguat pada musim hujan: udara lembap membuat virus bertahan lebih lama dan orang lebih banyak berkumpul di ruang tertutup. Kasus biasanya mengikuti 1–3 minggu setelah periode hujan.',
    transmission: 'Ditularkan lewat percikan napas (droplet)',
  },
};

export const DISEASE_IDS: DiseaseId[] = ['dbd', 'muntaber', 'influenza'];

// ---------------------------------------------------------------------------
// Curah hujan
// ---------------------------------------------------------------------------
export const RAIN = {
  color: '#2A78D6',
  colorSoft: '#DCE9FA',
  colorText: '#1C5CAB',
  /** Ramp sekuensial untuk peta curah hujan. */
  ramp: ['#EAF2FD', '#CDE2FB', '#9EC5F4', '#6DA7EC', '#3987E5', '#1C5CAB', '#0D366B'],
  /** Batas kelas mm/minggu (akumulasi 7 hari) untuk peta & label intensitas. */
  breaks: [10, 25, 50, 100, 150, 200],
  /** Ambang "hujan ekstrem" mingguan (mm) - penanda risiko genangan. */
  extremeWeekly: 150,
} as const;

export function rainIntensityLabel(mm: number): string {
  if (mm < 10) return 'Sangat ringan';
  if (mm < 50) return 'Ringan';
  if (mm < 100) return 'Sedang';
  if (mm < 150) return 'Lebat';
  return 'Ekstrem';
}

// ---------------------------------------------------------------------------
// Level peringatan
// ---------------------------------------------------------------------------
export interface LevelConfig {
  id: AlertLevel;
  /** Urutan keparahan 0..3. */
  rank: number;
  label: string;
  /** Batas bawah skor komposit. */
  minScore: number;
  /** Warna isian (peta, titik). Selalu didampingi label/ikon - tidak pernah warna saja. */
  color: string;
  colorSoft: string;
  colorText: string;
  /** Warna teks di atas isian `color`. */
  onColor: string;
  /** Arti singkat untuk publik. */
  meaning: string;
}

export const LEVELS: Record<AlertLevel, LevelConfig> = {
  normal: {
    id: 'normal',
    rank: 0,
    label: 'Normal',
    minScore: 0,
    color: '#7CC49C',
    colorSoft: '#E6F4EC',
    colorText: '#1E6B48',
    onColor: '#0B2A1C',
    meaning: 'Kasus dan cuaca dalam pola yang wajar. Tetap jaga kebersihan lingkungan.',
  },
  waspada: {
    id: 'waspada',
    rank: 1,
    label: 'Waspada',
    minScore: 40,
    color: '#F2C230',
    colorSoft: '#FCF3D0',
    colorText: '#735300',
    onColor: '#2B1F00',
    meaning: 'Ada sinyal awal: cuaca mendukung penularan atau kasus mulai bergerak naik.',
  },
  siaga: {
    id: 'siaga',
    rank: 2,
    label: 'Siaga',
    minScore: 60,
    color: '#EC7F2E',
    colorSoft: '#FCE6D3',
    colorText: '#8F3F06',
    onColor: '#2E1400',
    meaning: 'Kasus di atas pola normal dan faktor cuaca menguatkan. Perlu tindakan pencegahan aktif.',
  },
  awas: {
    id: 'awas',
    rank: 3,
    label: 'Awas',
    minScore: 80,
    color: '#C8322E',
    colorSoft: '#F9DCDA',
    colorText: '#9B1C19',
    onColor: '#FFFFFF',
    meaning: 'Lonjakan kasus nyata dan cenderung berlanjut. Perlu respons segera.',
  },
};

export const LEVEL_ORDER: AlertLevel[] = ['normal', 'waspada', 'siaga', 'awas'];

/** Bobot skor komposit (jumlah = 1). */
export const SCORE_WEIGHTS = { kasus: 0.5, cuaca: 0.3, tren: 0.2 } as const;

/** Horizon proyeksi (minggu ke depan). */
export const FORECAST_HORIZON = 4;
