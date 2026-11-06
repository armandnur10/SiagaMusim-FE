'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface SelectionValue {
  /** Id kelurahan yang sedang dilihat warga; null = tampilkan status seluruh kota. */
  selectedId: string | null;
  select: (id: string | null) => void;
}

/** Id elemen panel status di hero (tujuan gulir setelah memilih kelurahan). */
export const STATUS_PANEL_ID = 'status-kelurahan';

const SelectionContext = createContext<SelectionValue | null>(null);

/**
 * Pilihan kelurahan di halaman publik. Dibagi antara kolom pencarian, panel status,
 * dan peta, supaya memilih di satu tempat langsung tercermin di tempat lain.
 */
export function LandingSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const select = useCallback((id: string | null) => setSelectedId(id), []);
  const value = useMemo(() => ({ selectedId, select }), [selectedId, select]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useLandingSelection(): SelectionValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useLandingSelection() hanya tersedia di dalam <LandingSelectionProvider>.');
  return ctx;
}
