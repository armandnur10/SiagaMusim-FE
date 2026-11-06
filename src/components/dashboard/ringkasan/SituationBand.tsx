import Link from 'next/link';
import { Card, DiseaseTag, LevelBadge, ScoreScale } from '@/components/ui';
import { CITY_NAME, SCORE_WEIGHTS } from '@/lib/config';
import type { DiseaseSummary } from '@/lib/summary';

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** Bagian B (atas): pernyataan situasi penyakit terpilih — "jadi apa artinya" dalam dua kalimat. */
export function SituationBand({ summary }: { summary: DiseaseSummary }) {
  const { city, disease } = summary;
  return (
    <Card aria-labelledby="situasi-judul">
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 xl:grid-cols-12 xl:items-center">
        <div className="min-w-0 xl:col-span-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <LevelBadge level={city.level} size="lg" variant="solid" />
            <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold leading-5 text-ink-2">
              Situasi <DiseaseTag disease={disease} /> di {CITY_NAME}
            </p>
          </div>
          <h2
            id="situasi-judul"
            className="mt-3 max-w-[44rem] text-[19px] font-extrabold leading-7 tracking-tight text-ink sm:text-[22px] sm:leading-8"
          >
            {summary.headline}
          </h2>
          <p className="mt-1.5 max-w-[44rem] text-[14px] leading-6 text-ink-2 sm:text-[15px]">{summary.detail}</p>
        </div>

        <div className="min-w-0 border-t border-line pt-4 xl:col-span-4 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <p className="text-[13px] leading-5 text-ink-2">
            Skor risiko kota <strong className="text-[15px] font-extrabold text-ink">{city.score}</strong> dari 100
          </p>
          <ScoreScale score={city.score} className="mt-2 max-w-[420px]" />
          <p className="mt-3 text-[12px] leading-[18px] text-muted">
            {city.ruleNote ? `${city.ruleNote} ` : ''}
            Gabungan sinyal kasus {pct(SCORE_WEIGHTS.kasus)}, cuaca {pct(SCORE_WEIGHTS.cuaca)}, dan tren {pct(SCORE_WEIGHTS.tren)}.{' '}
            <Link href="/metodologi" className="font-semibold text-ink-2 underline underline-offset-2 hover:text-ink">
              Cara menghitung
            </Link>
          </p>
        </div>
      </div>
    </Card>
  );
}
