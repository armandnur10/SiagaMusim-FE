import clsx from 'clsx';
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { FORECAST_HORIZON } from '@/lib/config';
import { fmtDec, fmtInt } from '@/lib/format';
import type { Assessment, Forecast, RegionInfo } from '@/types/ews';

/** Angka kasus/ambang yang bisa pecahan: satu desimal, dibulatkan bila sudah ratusan. */
export const fmtCases = (v: number): string => (Math.abs(v) >= 100 ? fmtInt(v) : fmtDec(v, 1));

/** Nama tampil wilayah: kecamatan diberi awalan agar tidak tertukar dengan kelurahan bernama sama. */
export const regionTitle = (r: RegionInfo): string => (r.kind === 'kecamatan' ? `Kec. ${r.name}` : r.name);

export const regionHref = (id: string): string => `/dashboard/wilayah/${id}`;

export const isAboveThreshold = (a: Assessment): boolean => a.cases > a.threshold;

const DIRECTION: Record<Forecast['direction'], { label: string; Icon: LucideIcon }> = {
  naik: { label: 'Naik', Icon: ArrowUpRight },
  stabil: { label: 'Stabil', Icon: ArrowRight },
  turun: { label: 'Turun', Icon: ArrowDownRight },
};

/** Keterangan singkat bila proyeksi melampaui ambang (untuk sel tabel/kartu). */
export function exceedNote(a: Assessment, f: Forecast): string | null {
  const h = f.exceedsAtHorizon;
  if (h === null) return null;
  if (h === 1 && isAboveThreshold(a)) return 'tetap di atas ambang';
  return `lewati ambang dalam ${h} mgg`;
}

interface ForecastTrendProps {
  assessment: Assessment;
  forecast: Forecast;
  /** Satu baris (untuk kartu ponsel) alih-alih dua baris (sel tabel). */
  inline?: boolean;
  className?: string;
}

/** Arah proyeksi: ikon panah + kata (tidak pernah ikon saja), plus catatan ambang bila ada. */
export function ForecastTrend({ assessment, forecast, inline = false, className }: ForecastTrendProps) {
  const { label, Icon } = DIRECTION[forecast.direction];
  const note = exceedNote(assessment, forecast);
  return (
    <span className={clsx(inline ? 'inline-flex flex-wrap items-center gap-x-1.5' : 'block', className)}>
      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink">
        <Icon size={15} strokeWidth={2.25} className="shrink-0 text-ink-2" aria-hidden />
        {label}
      </span>
      {note && (
        <span className={clsx('text-[12px] leading-4 text-ink-2', inline ? 'inline' : 'mt-0.5 block')}>
          {inline ? `· ${note}` : note}
        </span>
      )}
    </span>
  );
}

/** Satu kalimat utuh tentang arah proyeksi dan hubungannya dengan ambang. */
export function forecastSentence(a: Assessment, f: Forecast): string {
  const dir = f.direction === 'naik' ? 'naik' : f.direction === 'turun' ? 'turun' : 'relatif stabil';
  const head = `Kasus diperkirakan ${dir} dalam ${FORECAST_HORIZON} minggu ke depan`;
  const h = f.exceedsAtHorizon;
  if (h === null) {
    return f.direction === 'naik' ? `${head}, tetapi masih di bawah ambang historis.` : `${head} dan tetap di bawah ambang historis.`;
  }
  if (h === 1 && isAboveThreshold(a)) {
    return `${head}${f.direction === 'turun' ? ', tetapi' : ' dan'} masih di atas ambang historis minggu depan.`;
  }
  return `${head}${f.direction === 'naik' ? ' dan' : ', tetapi'} melewati ambang historis ${h === 1 ? 'minggu depan' : `dalam ${h} minggu`}.`;
}
