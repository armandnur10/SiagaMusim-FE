'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { getRecommendations } from '@/lib/recommendations';
import type { AlertLevel, DiseaseId } from '@/types/ews';

interface RecommendationListProps {
  disease: DiseaseId;
  level: AlertLevel;
  /** Tab awal. Dasbor: 'dinas'; halaman publik: 'warga'. */
  defaultAudience?: 'warga' | 'dinas';
  /** Hanya tampilkan satu audiens tanpa tab. */
  only?: 'warga' | 'dinas';
}

/** Daftar tindakan yang disarankan untuk level & penyakit tertentu, dengan tab Warga / Dinas. */
export function RecommendationList({ disease, level, defaultAudience = 'dinas', only }: RecommendationListProps) {
  const [audience, setAudience] = useState<'warga' | 'dinas'>(only ?? defaultAudience);
  const rec = getRecommendations(disease, level);
  const active = only ?? audience;
  const items = rec[active];
  return (
    <div>
      {!only && (
        <div className="segmented mb-3" role="group" aria-label="Sasaran rekomendasi">
          <button type="button" aria-pressed={active === 'dinas'} onClick={() => setAudience('dinas')}>
            Untuk dinas &amp; kelurahan
          </button>
          <button type="button" aria-pressed={active === 'warga'} onClick={() => setAudience('warga')}>
            Untuk warga
          </button>
        </div>
      )}
      <ul className="grid gap-2.5">
        {items.map((text) => (
          <li key={text} className="flex items-start gap-2.5 text-[14px] leading-6 text-ink">
            <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Check size={11} strokeWidth={3} aria-hidden />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
