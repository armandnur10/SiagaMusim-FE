'use client';

import { CircleAlert } from 'lucide-react';
import { useEws } from '@/lib/data/EwsDataProvider';

interface DataGateProps {
  children: React.ReactNode;
  /** Tampilan saat memuat. Default: kerangka (skeleton) generik. */
  fallback?: React.ReactNode;
}

/**
 * Gerbang data: anak baru dirender setelah CSV selesai dimuat, sehingga komponen
 * di bawahnya aman memakai `useDataset()`.
 */
export function DataGate({ children, fallback }: DataGateProps) {
  const state = useEws();
  if (state.status === 'ready') return <>{children}</>;
  if (state.status === 'error') {
    return (
      <div role="alert" className="card mx-auto my-10 max-w-lg p-6 text-center">
        <CircleAlert className="mx-auto mb-3 text-ink-2" size={28} aria-hidden />
        <h2 className="text-[16px] font-bold text-ink">Data tidak dapat dimuat</h2>
        <p className="mt-1 text-[14px] leading-6 text-ink-2">
          {state.error} Periksa berkas CSV di folder <code className="font-mono text-[13px]">public/data</code>, lalu muat ulang halaman.
        </p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
          Muat ulang
        </button>
      </div>
    );
  }
  return (
    <>
      {fallback ?? (
        <div aria-busy="true" aria-label="Memuat data" className="grid grid-cols-1 gap-4">
          <div className="skeleton h-24" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="skeleton h-32" />
            <div className="skeleton h-32" />
            <div className="skeleton h-32" />
          </div>
          <div className="skeleton h-80" />
        </div>
      )}
    </>
  );
}
