'use client';

import clsx from 'clsx';
import { DISEASE_ICONS } from '@/components/ui';
import { DISEASES, DISEASE_IDS } from '@/lib/config';
import { useEws } from '@/lib/data/EwsDataProvider';
import type { DiseaseId } from '@/types/ews';

/**
 * Gerbang data "senyap" untuk bagian di bawah hero: saat gagal memuat cukup satu baris
 * keterangan, karena kartu galat lengkap (dengan tombol muat ulang) sudah tampil di hero.
 */
export function QuietGate({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const state = useEws();
  if (state.status === 'ready') return <>{children}</>;
  if (state.status === 'error') {
    return (
      <p className="rounded-[14px] border border-line bg-surface px-4 py-4 text-[14px] leading-6 text-ink-2">
        Bagian ini belum dapat ditampilkan karena data gagal dimuat.
      </p>
    );
  }
  return <>{fallback}</>;
}

interface DiseaseSwitchProps {
  value: DiseaseId;
  onChange: (d: DiseaseId) => void;
  /** Nama kelompok untuk pembaca layar, mis. "Penyakit pada peta". */
  label: string;
  className?: string;
}

/** Pilihan penyakit lokal satu bagian (halaman publik tidak punya filter global). Tinggi 44px untuk sentuhan. */
export function DiseaseSwitch({ value, onChange, label, className }: DiseaseSwitchProps) {
  return (
    <div className={clsx('segmented', className)} role="group" aria-label={label}>
      {DISEASE_IDS.map((id) => {
        const Icon = DISEASE_ICONS[id];
        const active = id === value;
        return (
          <button key={id} type="button" aria-pressed={active} onClick={() => onChange(id)} className="!min-h-[44px] flex-1 justify-center sm:flex-none sm:!px-3.5">
            <Icon size={15} strokeWidth={2.25} aria-hidden style={{ color: active ? DISEASES[id].color : undefined }} />
            {DISEASES[id].short}
          </button>
        );
      })}
    </div>
  );
}
