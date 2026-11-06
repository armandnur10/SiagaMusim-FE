import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { FORECAST_HORIZON } from '@/lib/config';
import { fmtDec, fmtInt } from '@/lib/format';
import type { Assessment, Forecast } from '@/types/ews';

/** Jumlah minggu pada grafik mini kartu status. */
export const SPARK_WEEKS = 26;
/** Jumlah minggu pada grafik hujan-kasus. */
export const CHART_WEEKS = 52;
/** Jumlah kelurahan pada daftar prioritas. */
export const PRIORITY_COUNT = 8;

/** Ambang/harapan bisa pecahan: satu desimal untuk angka kecil, bulat bila sudah ratusan. */
export const fmtThreshold = (v: number): string => (Math.abs(v) >= 100 ? fmtInt(v) : fmtDec(v, 1));

export const regionHref = (id: string): string => `/dashboard/wilayah/${id}`;

export const DIRECTION_ICON: Record<Forecast['direction'], LucideIcon> = {
  naik: ArrowUpRight,
  stabil: ArrowRight,
  turun: ArrowDownRight,
};

/** "naik, melewati ambang dalam 3 minggu" — frasa pendek arah proyeksi dan posisinya terhadap ambang. */
export function outlookPhrase(a: Assessment, f: Forecast): string {
  const h = f.exceedsAtHorizon;
  if (h === null) {
    return f.direction === 'naik' ? 'naik, masih di bawah ambang' : `${f.direction}, di bawah ambang`;
  }
  if (h === 1 && a.cases > a.threshold) return `${f.direction}, tetap di atas ambang`;
  return `${f.direction}, melewati ambang ${h === 1 ? 'minggu depan' : `dalam ${h} minggu`}`;
}

export const OUTLOOK_LABEL = `Proyeksi ${FORECAST_HORIZON} minggu`;

/** Deret `len` nilai terakhir yang berakhir di indeks `to` (inklusif). */
export function tail<T>(values: T[], to: number, len: number): T[] {
  return values.slice(Math.max(0, to - len + 1), to + 1);
}

/** Batas atas skala batang yang "bulat" (1 / 2 / 2,5 / 5 × 10^n) di atas nilai terbesar. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const unit = value / pow;
  const step = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return step * pow;
}
