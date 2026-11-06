'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useEws } from '@/lib/data/EwsDataProvider';
import { DISEASE_IDS } from '@/lib/config';
import type { DiseaseId, WeekInfo } from '@/types/ews';

interface FiltersValue {
  /** Penyakit yang sedang dilihat (berlaku di seluruh halaman dasbor). */
  disease: DiseaseId;
  setDisease: (d: DiseaseId) => void;
  /** Indeks minggu yang dilihat (sudah di-resolve; default = minggu terakhir). 0 bila data belum siap. */
  weekIndex: number;
  /** Objek minggu yang dilihat; null bila data belum siap. */
  week: WeekInfo | null;
  /** true bila sedang melihat minggu terakhir (bukan "mesin waktu"). */
  isLatest: boolean;
  setWeekIndex: (i: number) => void;
  /** Geser minggu: -1 mundur, +1 maju (otomatis dibatasi rentang data). */
  stepWeek: (delta: number) => void;
  resetWeek: () => void;
}

const FiltersContext = createContext<FiltersValue | null>(null);

/** Filter global dasbor: penyakit + minggu yang dilihat. Dipasang di layout /dashboard. */
export function DashboardFiltersProvider({ children }: { children: React.ReactNode }) {
  const { dataset } = useEws();
  const [disease, setDisease] = useState<DiseaseId>('dbd');
  const [picked, setPicked] = useState<number | null>(null); // null = ikuti minggu terakhir

  // Tautan dalam: /dashboard?penyakit=muntaber memilih penyakit saat pertama dibuka.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('penyakit');
    if (q && (DISEASE_IDS as string[]).includes(q)) setDisease(q as DiseaseId);
  }, []);

  const latest = dataset?.latestWeek ?? 0;
  const weekIndex = picked === null ? latest : Math.min(Math.max(picked, 0), latest);

  const setWeekIndex = useCallback((i: number) => setPicked(i >= latest ? null : Math.max(0, i)), [latest]);
  const stepWeek = useCallback(
    (delta: number) => setPicked((cur) => {
      const next = (cur ?? latest) + delta;
      return next >= latest ? null : Math.max(0, next);
    }),
    [latest],
  );
  const resetWeek = useCallback(() => setPicked(null), []);

  const value = useMemo<FiltersValue>(
    () => ({
      disease,
      setDisease,
      weekIndex,
      week: dataset ? dataset.weeks[weekIndex] : null,
      isLatest: weekIndex === latest,
      setWeekIndex,
      stepWeek,
      resetWeek,
    }),
    [disease, weekIndex, dataset, latest, setWeekIndex, stepWeek, resetWeek],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters() hanya tersedia di dalam halaman /dashboard.');
  return ctx;
}
