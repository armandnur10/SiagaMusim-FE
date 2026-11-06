'use client';

import clsx from 'clsx';
import { DISEASES, DISEASE_IDS } from '@/lib/config';
import type { DiseaseId } from '@/types/ews';

interface DiseaseSwitcherProps {
  value: DiseaseId;
  onChange: (d: DiseaseId) => void;
  className?: string;
}

/** Pemilih penyakit (kontrol tersegmentasi). Titik warna = warna seri penyakit di semua grafik. */
export function DiseaseSwitcher({ value, onChange, className }: DiseaseSwitcherProps) {
  return (
    <div className={clsx('segmented', className)} role="group" aria-label="Pilih penyakit">
      {DISEASE_IDS.map((id) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DISEASES[id].color }} />
          {DISEASES[id].short}
        </button>
      ))}
    </div>
  );
}
