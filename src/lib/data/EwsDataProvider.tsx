'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DATA_URLS } from '@/lib/config';
import type { Dataset } from '@/types/ews';
import { buildDataset } from './dataset';

type EwsState =
  | { status: 'loading'; dataset: null; error: null }
  | { status: 'ready'; dataset: Dataset; error: null }
  | { status: 'error'; dataset: null; error: string };

const EwsContext = createContext<EwsState>({ status: 'loading', dataset: null, error: null });

// Cache tingkat modul: CSV hanya diunduh & diurai sekali per sesi tab.
let datasetPromise: Promise<Dataset> | null = null;
function loadDataset(): Promise<Dataset> {
  if (!datasetPromise) {
    datasetPromise = Promise.all([fetch(DATA_URLS.timeseries), fetch(DATA_URLS.wilayah)])
      .then(async ([ts, wil]) => {
        if (!ts.ok || !wil.ok) throw new Error(`Gagal memuat CSV (HTTP ${ts.status}/${wil.status}).`);
        return buildDataset(await ts.text(), await wil.text());
      })
      .catch((err) => {
        datasetPromise = null; // izinkan coba lagi
        throw err;
      });
  }
  return datasetPromise;
}

/**
 * Memuat dataset CSV di sisi klien (frontend-only) dan membagikannya ke seluruh aplikasi.
 * Mengganti berkas di /public/data cukup untuk memperbarui seluruh tampilan.
 */
export function EwsDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EwsState>({ status: 'loading', dataset: null, error: null });

  useEffect(() => {
    let alive = true;
    loadDataset()
      .then((dataset) => alive && setState({ status: 'ready', dataset, error: null }))
      .catch((err: unknown) =>
        alive && setState({ status: 'error', dataset: null, error: err instanceof Error ? err.message : 'Gagal memuat data.' }),
      );
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <EwsContext.Provider value={value}>{children}</EwsContext.Provider>;
}

/** Status pemuatan + dataset (bisa null). Pakai ini bila komponen perlu menangani loading sendiri. */
export function useEws(): EwsState {
  return useContext(EwsContext);
}

/**
 * Dataset yang pasti tersedia. HANYA dipakai di bawah <DataGate>, yang menjamin
 * komponen anak baru dirender setelah data siap.
 */
export function useDataset(): Dataset {
  const state = useContext(EwsContext);
  if (state.status !== 'ready') throw new Error('useDataset() dipanggil sebelum data siap. Bungkus komponen dengan <DataGate>.');
  return state.dataset;
}
