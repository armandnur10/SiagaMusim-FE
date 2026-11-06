import clsx from 'clsx';
import { DISEASES } from '@/lib/config';
import type { DiseaseId } from '@/types/ews';
import { DISEASE_ICONS } from './icons';

interface DiseaseTagProps {
  disease: DiseaseId;
  /** dot = titik warna + nama; chip = pil berlatar lembut dengan ikon. */
  variant?: 'dot' | 'chip';
  /** Tampilkan nama lengkap alih-alih nama pendek. */
  full?: boolean;
  className?: string;
}

/** Penanda penyakit: warna seri hanya pada titik/ikon, teks tetap warna tinta. */
export function DiseaseTag({ disease, variant = 'dot', full = false, className }: DiseaseTagProps) {
  const d = DISEASES[disease];
  const Icon = DISEASE_ICONS[disease];
  if (variant === 'chip') {
    return (
      <span
        className={clsx('inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap', className)}
        style={{ backgroundColor: d.colorSoft, color: d.colorText }}
      >
        <Icon size={14} strokeWidth={2.25} aria-hidden />
        {full ? d.name : d.short}
      </span>
    );
  }
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink whitespace-nowrap', className)}>
      <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
      {full ? d.name : d.short}
    </span>
  );
}
