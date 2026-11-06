import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LevelBadge } from '@/components/ui';
import { LEVELS, LEVEL_ORDER } from '@/lib/config';
import { SectionHeading } from './SectionHeading';

/** Arti empat level, dari yang paling ringan (Normal) sampai yang paling serius (Awas). */
export function LevelGuide() {
  return (
    <section aria-labelledby="level-title">
      <SectionHeading id="level-title" eyebrow="Cara membaca status" title="Arti empat level peringatan" className="mb-5">
        Level yang sama dipakai untuk ketiga penyakit, dari yang paling ringan sampai yang paling serius.
      </SectionHeading>
      <ol className="card grid grid-cols-1 gap-px overflow-hidden bg-line sm:grid-cols-2 lg:grid-cols-4">
        {LEVEL_ORDER.map((id, i) => (
          <li key={id} className="min-w-0 bg-surface p-5">
            <p className="num text-[12px] font-bold leading-4 text-muted">Level {i + 1}</p>
            <LevelBadge level={id} size="lg" variant="solid" className="mt-2" />
            <p className="mt-3 text-[14px] leading-6 text-ink-2">{LEVELS[id].meaning}</p>
          </li>
        ))}
      </ol>
      <Link
        href="/metodologi"
        className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-bold text-brand hover:text-brand-strong"
      >
        Bagaimana level dihitung
        <ArrowRight size={16} aria-hidden />
      </Link>
    </section>
  );
}
