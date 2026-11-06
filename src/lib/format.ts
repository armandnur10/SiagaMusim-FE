import type { WeekInfo } from '@/types/ews';

const LOCALE = 'id-ID';
const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });

/** 12345 -> "12.345" */
export const fmtInt = (n: number): string => intFmt.format(Math.round(n));

/** 12.345 -> "12,3" (jumlah desimal bisa diatur) */
export const fmtDec = (n: number, digits = 1): string =>
  new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

/** 3063010 -> "3,1 jt" */
export const fmtCompact = (n: number): string => compactFmt.format(n);

/** Curah hujan: "168 mm" (di bawah 10 mm pakai satu desimal). */
export const fmtRain = (mm: number): string => `${mm < 10 ? fmtDec(mm, 1) : fmtInt(mm)} mm`;

/** +12% / −8% (pakai tanda minus tipografis). */
export const fmtSignedPct = (pct: number): string => {
  const r = Math.round(pct);
  if (r === 0) return '0%';
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}%`;
};

const parse = (iso: string): Date => new Date(iso + 'T00:00:00Z');
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayMonthLongYear = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat(LOCALE, { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monthOnly = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' });

/** "26 Okt" */
export const fmtDateShort = (iso: string): string => dayMonth.format(parse(iso));
/** "26 Okt 2026" */
export const fmtDate = (iso: string): string => dayMonthYear.format(parse(iso));
/** "26 Oktober 2026" */
export const fmtDateLong = (iso: string): string => dayMonthLongYear.format(parse(iso));
/** "Okt 26" (bulan + tahun 2 digit, untuk sumbu waktu) */
export const fmtMonthYear = (iso: string): string => monthYear.format(parse(iso));
/** "Okt" */
export const fmtMonth = (iso: string): string => monthOnly.format(parse(iso));

/** "M44" */
export const fmtWeekShort = (w: Pick<WeekInfo, 'isoWeek'>): string => `M${w.isoWeek}`;
/** "Minggu ke-44, 2026" */
export const fmtWeekLong = (w: Pick<WeekInfo, 'isoWeek' | 'isoYear'>): string => `Minggu ke-${w.isoWeek}, ${w.isoYear}`;
/** "26 Okt – 1 Nov 2026" */
export const fmtWeekRange = (w: Pick<WeekInfo, 'date' | 'endDate'>): string =>
  `${fmtDateShort(w.date)} – ${fmtDate(w.endDate)}`;
