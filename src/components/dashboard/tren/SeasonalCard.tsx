'use client';

import { useMemo } from 'react';
import { SeasonalOverlayChart } from '@/components/charts';
import { Card, CardHeader, DiseaseTag } from '@/components/ui';
import { DISEASES, RAIN } from '@/lib/config';
import { fmtInt } from '@/lib/format';
import type { Dataset, DiseaseId } from '@/types/ews';
import { ytdComparison, ytdSentence } from './helpers';

interface SeasonalCardProps {
  ds: Dataset;
  regionId: string;
  disease: DiseaseId;
  weekIndex: number;
}

/** "Dibanding tahun-tahun sebelumnya": kasus dan hujan per minggu epidemiologi, satu garis per tahun. */
export function SeasonalCard({ ds, regionId, disease, weekIndex }: SeasonalCardProps) {
  const d = DISEASES[disease];
  const year = ds.weeks[weekIndex].isoYear;

  // Deret dipotong pada minggu yang dilihat, agar tahun yang disorot berakhir di sana.
  const data = useMemo(() => {
    const s = ds.series[regionId];
    const weeks = ds.weeks.slice(0, weekIndex + 1);
    const cases = s.cases[disease].slice(0, weekIndex + 1);
    const rain = s.rain.slice(0, weekIndex + 1);
    return {
      weeks,
      cases,
      rain,
      yearCount: new Set(weeks.map((w) => w.isoYear)).size,
      casesYtd: ytdComparison(ds.weeks, s.cases[disease], weekIndex),
      rainYtd: ytdComparison(ds.weeks, s.rain, weekIndex),
    };
  }, [ds, regionId, disease, weekIndex]);

  return (
    <Card>
      <CardHeader
        title="Dibanding tahun-tahun sebelumnya"
        subtitle={
          data.yearCount > 1
            ? `Tiap garis adalah satu tahun pada kalender yang sama (Januari sampai Desember). Tahun ${year} berwarna, tahun lain abu-abu sebagai pembanding.`
            : `Sampai minggu yang dilihat baru ada data tahun ${year}, jadi belum ada garis tahun lain sebagai pembanding.`
        }
      />
      <div className="grid grid-cols-1 gap-x-8 gap-y-7 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col" aria-label={`Kasus ${d.short} per tahun`}>
          <h3 className="mb-2.5 flex items-center gap-2 text-[14px] font-bold leading-5 text-ink">
            <DiseaseTag disease={disease} className="!text-[14px] !font-bold" />
            <span className="font-semibold text-ink-2">kasus baru per minggu</span>
          </h3>
          <SeasonalOverlayChart
            weeks={data.weeks}
            values={data.cases}
            color={d.color}
            unit="kasus"
            valueLabel="Kasus baru/minggu"
            height={280}
            highlightYear={year}
          />
          <p className="mt-3 text-[13.5px] leading-[22px] text-ink-2">{ytdSentence(data.casesYtd, `kasus ${d.short}`, (v) => fmtInt(v))}</p>
        </section>

        <section className="flex min-w-0 flex-col border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0" aria-label="Curah hujan per tahun">
          <h3 className="mb-2.5 flex items-center gap-2 text-[14px] font-bold leading-5 text-ink">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RAIN.color }} />
              Curah hujan
            </span>
            <span className="font-semibold text-ink-2">mm per minggu</span>
          </h3>
          <SeasonalOverlayChart
            weeks={data.weeks}
            values={data.rain}
            color={RAIN.color}
            unit="mm"
            valueLabel="Curah hujan (mm/minggu)"
            height={280}
            highlightYear={year}
          />
          <p className="mt-3 text-[13.5px] leading-[22px] text-ink-2">{ytdSentence(data.rainYtd, 'curah hujan', (v) => `${fmtInt(v)} mm`)}</p>
        </section>
      </div>
    </Card>
  );
}
