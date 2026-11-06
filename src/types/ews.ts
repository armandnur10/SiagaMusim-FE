/** Kontrak tipe inti aplikasi Siaga Musim (EWS penyakit berbasis cuaca). */

export type DiseaseId = 'dbd' | 'muntaber' | 'influenza';
export type AlertLevel = 'normal' | 'waspada' | 'siaga' | 'awas';
export type RegionKind = 'kota' | 'kecamatan' | 'kelurahan';

export interface WeekInfo {
  /** Indeks 0..N-1 pada deret waktu. */
  index: number;
  /** Tanggal awal minggu (Senin), format YYYY-MM-DD. */
  date: string;
  /** Tanggal akhir minggu (Minggu), format YYYY-MM-DD. */
  endDate: string;
  isoYear: number;
  /** Nomor minggu epidemiologi (ISO 8601, Senin-Minggu). */
  isoWeek: number;
}

export interface RegionInfo {
  /** kelurahan: slug nama (mis. "kampung-melayu"); kecamatan: "kec-…"; kota: "kota-jakarta-timur". */
  id: string;
  kind: RegionKind;
  name: string;
  /** Nama & id kecamatan induk (hanya untuk kelurahan). */
  kecamatan?: string;
  kecamatanId?: string;
  population: number;
  areaKm2: number;
  lat: number;
  lon: number;
  /** Id kelurahan anggota (untuk kecamatan & kota). */
  childIds: string[];
}

export interface RegionSeries {
  /** Curah hujan mingguan (mm). Untuk kecamatan/kota: rata-rata tertimbang luas. */
  rain: number[];
  /** Jumlah kasus baru per minggu. Untuk kecamatan/kota: penjumlahan kelurahan. */
  cases: Record<DiseaseId, number[]>;
}

export interface Dataset {
  weeks: WeekInfo[];
  /** Indeks minggu terakhir yang tersedia (= "minggu berjalan" aplikasi). */
  latestWeek: number;
  cityId: string;
  kecamatanIds: string[];
  kelurahanIds: string[];
  regions: Record<string, RegionInfo>;
  series: Record<string, RegionSeries>;
}

export interface SignalScores {
  /** Sinyal Kasus 0-100: kasus 2 minggu terakhir dibanding pola historis. */
  kasus: number;
  /** Sinyal Cuaca 0-100: paparan hujan pada jendela jeda penyakit (persentil historis). */
  cuaca: number;
  /** Sinyal Tren 0-100: laju perubahan kasus 3 minggu terakhir vs 3 minggu sebelumnya. */
  tren: number;
}

export interface Assessment {
  regionId: string;
  disease: DiseaseId;
  weekIndex: number;
  /** Kasus baru minggu ini. */
  cases: number;
  /** Kasus minggu sebelumnya (0 jika tidak ada). */
  casesPrev: number;
  /** Angka insidensi mingguan per 100.000 penduduk. */
  incidenceRate: number;
  /** Kasus harapan (rata-rata historis minggu yang sama, tahun lain). */
  expected: number;
  /** Ambang waspada = harapan + 2 simpangan baku. */
  threshold: number;
  /** Skor-z rata-rata kasus 2 minggu terakhir terhadap pola historis. */
  zScore: number;
  /** Jumlah minggu berturut-turut (s.d. minggu ini) kasus berada di atas ambang. */
  weeksAboveThreshold: number;
  /**
   * Paparan hujan terkini (mm/minggu): rata-rata tertimbang hujan beberapa minggu TERAKHIR
   * dengan bobot jeda penyakit. Inilah hujan yang "akan matang" menjadi kasus pada jendela jedanya.
   */
  rainExposure: number;
  /** Paparan hujan normal (klimatologi) untuk periode yang sama (mm/minggu). */
  rainExposureNormal: number;
  /** Curah hujan minggu ini (mm). */
  rainThisWeek: number;
  /** Jumlah kasus 3 minggu terakhir dan 3 minggu sebelumnya. */
  casesRecent3: number;
  casesPrev3: number;
  /** Perubahan kasus 3 minggu terakhir vs 3 minggu sebelumnya, dalam persen (penyebut minimal 3 kasus). */
  trendPct: number;
  signals: SignalScores;
  /** Skor risiko komposit 0-100. */
  score: number;
  level: AlertLevel;
  /** Level murni dari skor, sebelum aturan bukti kasus diterapkan. */
  levelFromScore: AlertLevel;
  /** Penjelasan bila level diubah oleh aturan bukti kasus (null bila tidak). */
  ruleNote: string | null;
  /** Kalimat singkat penjelas pemicu utama (Bahasa Indonesia). */
  drivers: string[];
}

export interface ForecastPoint {
  /** 1 = minggu depan, dst. */
  horizon: number;
  /** Tanggal awal minggu proyeksi (Senin). */
  date: string;
  isoWeek: number;
  expected: number;
  low: number;
  high: number;
  /** Ambang historis pada minggu proyeksi. */
  threshold: number;
  /** Kasus harapan historis pada minggu proyeksi. */
  baseline: number;
}

export interface Forecast {
  regionId: string;
  disease: DiseaseId;
  weekIndex: number;
  points: ForecastPoint[];
  /** Horizon pertama (1-4) saat proyeksi melampaui ambang; null bila tidak. */
  exceedsAtHorizon: number | null;
  /** Arah umum proyeksi dibanding minggu ini. */
  direction: 'naik' | 'stabil' | 'turun';
}

export interface LagCorrelationPoint {
  /** Jeda dalam minggu (hujan mendahului kasus). */
  lag: number;
  /** Korelasi Pearson -1..1. */
  r: number;
}
