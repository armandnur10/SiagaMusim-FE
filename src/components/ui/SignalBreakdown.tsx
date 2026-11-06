import clsx from 'clsx';
import { LEVELS, LEVEL_ORDER, SCORE_WEIGHTS } from '@/lib/config';
import type { Assessment } from '@/types/ews';

const SIGNALS: { key: keyof Assessment['signals']; label: string; hint: string }[] = [
  { key: 'kasus', label: 'Sinyal kasus', hint: 'Kasus 2 minggu terakhir dibanding pola historis' },
  { key: 'cuaca', label: 'Sinyal cuaca', hint: 'Hujan terkini dibanding seluruh riwayat wilayah' },
  { key: 'tren', label: 'Sinyal tren', hint: 'Arah kasus 3 minggu terakhir' },
];

interface SignalBreakdownProps {
  assessment: Assessment;
  /** Sembunyikan kalimat penjelas tiap sinyal (untuk ruang sempit). */
  dense?: boolean;
  className?: string;
}

/**
 * Rincian tiga sinyal pembentuk skor (0-100) beserta bobotnya.
 * Batang berwarna tinta netral: keparahan dibawa oleh lencana level, bukan oleh batang ini.
 */
export function SignalBreakdown({ assessment, dense = false, className }: SignalBreakdownProps) {
  return (
    <dl className={clsx('grid gap-3', className)}>
      {SIGNALS.map(({ key, label, hint }) => {
        const value = assessment.signals[key];
        const weight = Math.round(SCORE_WEIGHTS[key] * 100);
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] font-semibold text-ink">
                {label} <span className="font-medium text-muted">· bobot {weight}%</span>
              </dt>
              <dd className="num text-[13px] font-bold text-ink">{value}</dd>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunken" role="presentation">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, value)}%` }} />
            </div>
            {!dense && <p className="mt-1 text-[12px] leading-4 text-muted">{hint}</p>}
          </div>
        );
      })}
    </dl>
  );
}

interface ScoreScaleProps {
  score: number;
  className?: string;
}

/** Skala skor 0-100 dengan empat pita level dan penanda posisi skor saat ini. */
export function ScoreScale({ score, className }: ScoreScaleProps) {
  const bounds = LEVEL_ORDER.map((id, i) => ({
    id,
    from: LEVELS[id].minScore,
    to: i < LEVEL_ORDER.length - 1 ? LEVELS[LEVEL_ORDER[i + 1]].minScore : 100,
  }));
  const pos = Math.min(100, Math.max(0, score));
  return (
    <div className={clsx('w-full', className)} role="img" aria-label={`Skor risiko ${score} dari 100`}>
      <div className="relative pt-4">
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {bounds.map((b) => (
            <div key={b.id} style={{ width: `${b.to - b.from}%`, backgroundColor: LEVELS[b.id].color }} />
          ))}
        </div>
        <div className="absolute top-0 -translate-x-1/2" style={{ left: `${pos}%` }} aria-hidden>
          <div className="mx-auto h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-ink" />
          <div className="mx-auto mt-0.5 h-3.5 w-0.5 rounded bg-ink" />
        </div>
      </div>
      <div className="mt-1.5 flex text-[11px] font-medium text-muted">
        {bounds.map((b) => (
          <div key={b.id} style={{ width: `${b.to - b.from}%` }} className="truncate">
            {LEVELS[b.id].label}
          </div>
        ))}
      </div>
    </div>
  );
}
