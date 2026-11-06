'use client';

import clsx from 'clsx';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { useEws } from '@/lib/data/EwsDataProvider';
import { fmtWeekRange, fmtWeekShort } from '@/lib/format';
import { useFilters } from '@/lib/state/filters';

/**
 * Penggeser minggu ("mesin waktu"): melihat status pada minggu mana pun dalam data.
 * Saat bukan minggu terakhir, kontrol diberi penanda agar pengguna sadar sedang melihat riwayat.
 */
export function WeekStepper({ className }: { className?: string }) {
  const { dataset } = useEws();
  const { week, weekIndex, isLatest, stepWeek, resetWeek } = useFilters();
  if (!dataset || !week) return <div className={clsx('skeleton h-10 w-56', className)} />;
  const atStart = weekIndex <= 0;
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx(
          'flex h-10 items-center rounded-[11px] border bg-surface',
          isLatest ? 'border-line-strong' : 'border-ink',
        )}
      >
        <button
          type="button"
          className="flex h-full w-9 items-center justify-center rounded-l-[10px] text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-35"
          onClick={() => stepWeek(-1)}
          disabled={atStart}
          aria-label="Minggu sebelumnya"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <div className="min-w-[168px] px-1 text-center leading-tight" aria-live="polite">
          <span className="num text-[13px] font-bold text-ink">
            {fmtWeekShort(week)} · {week.isoYear}
          </span>
          <span className="num block text-[11px] font-medium text-muted">{fmtWeekRange(week)}</span>
        </div>
        <button
          type="button"
          className="flex h-full w-9 items-center justify-center rounded-r-[10px] text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-35"
          onClick={() => stepWeek(1)}
          disabled={isLatest}
          aria-label="Minggu berikutnya"
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
      {!isLatest && (
        <button type="button" onClick={resetWeek} className="btn btn-ghost h-10 min-h-0 px-3 text-[13px]">
          <History size={15} aria-hidden />
          <span className="hidden sm:inline">Kembali ke minggu terbaru</span>
          <span className="sm:hidden">Terbaru</span>
        </button>
      )}
    </div>
  );
}
