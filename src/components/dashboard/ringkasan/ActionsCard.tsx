import { Fragment } from 'react';
import Link from 'next/link';
import { Card, DiseaseTag, LevelBadge, RecommendationList } from '@/components/ui';
import { LEVELS } from '@/lib/config';
import type { DiseaseSummary } from '@/lib/summary';
import type { Dataset } from '@/types/ews';
import { regionHref } from './helpers';

/** Jumlah kelurahan yang disebut sebagai titik mulai. */
const FOCUS_COUNT = 3;

interface ActionsCardProps {
  ds: Dataset;
  summary: DiseaseSummary;
  className?: string;
}

/** Bagian E: tindakan yang disarankan untuk level tingkat kota penyakit terpilih, plus wilayah untuk memulai. */
export function ActionsCard({ ds, summary, className }: ActionsCardProps) {
  const { city, disease } = summary;
  const lv = LEVELS[city.level];
  const focus = summary.ranked.filter((a) => a.level !== 'normal').slice(0, FOCUS_COUNT);

  return (
    <Card className={className} aria-labelledby="tindakan-judul">
      <div className="flex h-full flex-col">
        <header className="mb-4">
          <h2 id="tindakan-judul" className="text-[16px] font-bold leading-6 text-ink">
            Tindakan yang disarankan saat {lv.label}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-ink-2">
            <LevelBadge level={city.level} size="sm" />
            <DiseaseTag disease={disease} />
            <span>tingkat kota</span>
          </p>
          <p className="mt-2 text-[13px] leading-5 text-ink-2">{lv.meaning}</p>
        </header>

        {/* key: tab audiens kembali ke "dinas" setiap kali penyakit/level berganti. */}
        <RecommendationList key={`${disease}-${city.level}`} disease={disease} level={city.level} defaultAudience="dinas" />

        {focus.length > 0 && (
          <p className="mt-4 border-t border-line pt-3 text-[13px] leading-5 text-ink-2">
            <span className="font-semibold text-ink">Mulai dari kelurahan paling mendesak:</span>{' '}
            {focus.map((a, i) => (
              <Fragment key={a.regionId}>
                {i > 0 && (i === focus.length - 1 ? (focus.length > 2 ? ', dan ' : ' dan ') : ', ')}
                <Link
                  href={regionHref(a.regionId)}
                  className="font-semibold text-brand underline-offset-2 hover:text-brand-strong hover:underline"
                >
                  {ds.regions[a.regionId].name}
                </Link>{' '}
                ({LEVELS[a.level].label})
              </Fragment>
            ))}
            .
          </p>
        )}

        <p className="mt-auto pt-4 text-[12px] leading-[18px] text-muted">
          Rekomendasi umum sesuai praktik kesehatan masyarakat, bukan pengganti protokol resmi Dinas Kesehatan.
        </p>
      </div>
    </Card>
  );
}
