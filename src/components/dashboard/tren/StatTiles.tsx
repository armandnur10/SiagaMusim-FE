'use client';

import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { LevelBadge } from '@/components/ui';
import { DISEASES, FORECAST_HORIZON, rainIntensityLabel } from '@/lib/config';
import { fmtDec, fmtInt, fmtRain, fmtWeekShort } from '@/lib/format';
import type { Assessment, DiseaseId, Forecast } from '@/types/ews';
import { exceedText, fmtCases } from './helpers';

const DIRECTION: Record<Forecast['direction'], { label: string; Icon: LucideIcon }> = {
  naik: { label: 'Naik', Icon: ArrowUpRight },
  stabil: { label: 'Stabil', Icon: ArrowRight },
  turun: { label: 'Turun', Icon: ArrowDownRight },
};

function Tile({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="card flex min-w-0 flex-col p-4">
      <dt className="text-[13px] font-semibold leading-5 text-ink-2">{label}</dt>
      <dd className="mt-1 flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-baseline gap-x-1.5 text-[26px] font-extrabold leading-8 tracking-tight text-ink">{value}</span>
        {children && <span className="mt-1.5 block text-[12.5px] leading-[18px] text-ink-2">{children}</span>}
      </dd>
    </div>
  );
}

const Unit = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[14px] font-semibold tracking-normal text-ink-2">{children}</span>
);

interface StatTilesProps {
  disease: DiseaseId;
  assessment: Assessment;
  forecast: Forecast;
  /** Curah hujan klimatologis untuk minggu kalender ini (mm). */
  rainNormal: number;
}

/** Empat angka ringkas untuk wilayah, penyakit, dan minggu yang dilihat. */
export function StatTiles({ disease, assessment: a, forecast: f, rainNormal }: StatTilesProps) {
  const d = DISEASES[disease];
  const ratio = a.rainExposureNormal > 0 ? a.rainExposure / a.rainExposureNormal : null;
  const dir = DIRECTION[f.direction];
  const lastPoint = f.points[f.points.length - 1];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label={`Kasus ${d.short} minggu ini`}
        value={
          <>
            {fmtInt(a.cases)}
            <Unit>kasus</Unit>
          </>
        }
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <LevelBadge level={a.level} size="sm" />
          <span>
            ambang {fmtCases(a.threshold)} · rata-rata historis {fmtCases(a.expected)}
          </span>
        </span>
      </Tile>

      <Tile
        label="Hujan minggu ini"
        value={
          <>
            {a.rainThisWeek < 10 ? fmtDec(a.rainThisWeek, 1) : fmtInt(a.rainThisWeek)}
            <Unit>mm</Unit>
          </>
        }
      >
        {rainIntensityLabel(a.rainThisWeek)} · normalnya sekitar {fmtRain(rainNormal)} pada minggu ini
      </Tile>

      <Tile
        label="Paparan hujan terkini"
        value={
          ratio === null ? (
            '–'
          ) : (
            <>
              {fmtDec(ratio, 1)}×<Unit>normal</Unit>
            </>
          )
        }
      >
        Rata-rata tertimbang hujan beberapa minggu terakhir ({fmtRain(a.rainExposure)} per minggu), yang memengaruhi kasus {d.lagLabel}{' '}
        kemudian.
      </Tile>

      <Tile
        label={`Proyeksi ${FORECAST_HORIZON} minggu`}
        value={
          <span className="inline-flex items-center gap-1.5">
            <dir.Icon size={24} strokeWidth={2.5} className="shrink-0 text-ink-2" aria-hidden />
            {dir.label}
          </span>
        }
      >
        {exceedText(a, f)}
        {lastPoint && (
          <>
            {' '}
            · sekitar {fmtCases(lastPoint.expected)} kasus pada {fmtWeekShort(lastPoint)}
          </>
        )}
      </Tile>
    </dl>
  );
}
