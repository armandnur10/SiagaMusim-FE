'use client';

import { useEws } from '@/lib/data/EwsDataProvider';
import { fmtWeekLong, fmtWeekRange } from '@/lib/format';

/** Label minggu data terbaru, mis. "Minggu ke-44, 2026 · 26 Okt – 1 Nov 2026". */
export function WeekLabel() {
  const { dataset: ds, status } = useEws();
  if (!ds) {
    return status === 'error' ? (
      <p className="eyebrow">Status mingguan</p>
    ) : (
      <div aria-hidden className="skeleton h-4 w-64 max-w-full" />
    );
  }
  const week = ds.weeks[ds.latestWeek];
  return (
    <p className="eyebrow">
      {fmtWeekLong(week)} <span aria-hidden>·</span> <span className="whitespace-nowrap">{fmtWeekRange(week)}</span>
    </p>
  );
}
