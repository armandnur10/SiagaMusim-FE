'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';
import { Sparkline } from '@/components/charts';
import { DiseaseTag, LevelBadge, LevelDot } from '@/components/ui';
import { DISEASES, DISEASE_IDS, LEVELS, LEVEL_ORDER } from '@/lib/config';
import { baselineSeries } from '@/lib/engines/risk';
import { fmtInt } from '@/lib/format';
import type { DiseaseSummary } from '@/lib/summary';
import type { AlertLevel, Dataset, DiseaseId } from '@/types/ews';
import { DIRECTION_ICON, OUTLOOK_LABEL, SPARK_WEEKS, fmtThreshold, outlookPhrase, tail } from './helpers';

/** Level terberat dulu: urutan baca yang sama dengan daftar prioritas dan legenda peta. */
const LEVELS_HIGH_TO_LOW: AlertLevel[] = [...LEVEL_ORDER].reverse();

interface LevelBreakdownProps {
  counts: Record<AlertLevel, number>;
  total: number;
}

/** Sebaran kelurahan menurut level: batang tersegmen tipis + jumlah berlabel (tidak pernah warna saja). */
function LevelBreakdown({ counts, total }: LevelBreakdownProps) {
  const parts = LEVELS_HIGH_TO_LOW.filter((l) => counts[l] > 0);
  return (
    <div className="[container-type:inline-size]">
      <p className="text-[12px] font-semibold leading-4 text-muted">Sebaran {fmtInt(total)} kelurahan</p>
      <div className="mt-2 flex h-2 gap-0.5" aria-hidden>
        {parts.map((l) => (
          <span
            key={l}
            className="h-full min-w-[4px] rounded-full"
            style={{ flexGrow: counts[l], flexBasis: 0, backgroundColor: LEVELS[l].color }}
          />
        ))}
      </div>
      {/* Kartu lebar: satu baris; kartu sempit: kisi 2×2 yang rapi (tanpa satu butir yatim di baris kedua). */}
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 [@container(min-width:312px)]:flex [@container(min-width:312px)]:justify-between [@container(min-width:312px)]:gap-x-2">
        {LEVELS_HIGH_TO_LOW.map((l) => (
          <li key={l} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-5">
            <LevelDot level={l} size={8} />
            <span className={counts[l] > 0 ? 'text-ink-2' : 'text-muted'}>{LEVELS[l].label}</span>
            <span className={clsx('font-bold', counts[l] > 0 ? 'text-ink' : 'text-muted')}>{fmtInt(counts[l])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface StatusCardProps {
  ds: Dataset;
  summary: DiseaseSummary;
  weekIndex: number;
  active: boolean;
  onSelect: () => void;
}

function StatusCard({ ds, summary, weekIndex, active, onSelect }: StatusCardProps) {
  const { disease, city, cityForecast, counts } = summary;
  const d = DISEASES[disease];
  const values = tail(ds.series[ds.cityId].cases[disease], weekIndex, SPARK_WEEKS);
  const threshold = tail(baselineSeries(ds, ds.cityId, disease).threshold, weekIndex, SPARK_WEEKS);
  const OutlookIcon = DIRECTION_ICON[cityForecast.direction];
  const titleId = `status-${disease}`;

  return (
    <article
      aria-labelledby={titleId}
      className={clsx(
        'card relative flex flex-col p-4 transition-colors sm:p-5',
        active ? 'border-brand ring-1 ring-brand' : 'hover:border-line-strong',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id={titleId} className="min-w-0">
          <DiseaseTag disease={disease} className="!text-[15px]" />
          <span className="sr-only"> ({d.name})</span>
        </h2>
        {/* Tombol membentang ke seluruh kartu lewat ::after, sehingga isi kartu tetap berupa teks biasa bagi pembaca layar. */}
        <button
          type="button"
          aria-pressed={active}
          aria-label={`Tampilkan rincian ${d.short} di halaman ini`}
          onClick={onSelect}
          className={clsx(
            'inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-semibold',
            'after:absolute after:inset-0 after:rounded-[14px] after:content-[""]',
            'focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand',
            active ? 'bg-brand text-white' : 'border border-line-strong text-ink-2',
          )}
        >
          {active && <Check size={12} strokeWidth={3} aria-hidden />}
          {active ? 'Ditampilkan' : 'Tampilkan'}
        </button>
      </div>

      <div className="mt-4">
        <LevelBadge level={city.level} size="lg" />
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <p className="min-w-0">
          <span className="block text-[32px] font-extrabold leading-9 tracking-tight text-ink">{fmtInt(city.cases)}</span>
          <span className="mt-0.5 block text-[13px] font-semibold leading-5 text-ink-2">kasus minggu ini</span>
        </p>
        <figure className="shrink-0">
          <Sparkline
            values={values}
            threshold={threshold}
            color={d.color}
            width={120}
            height={44}
            fill
            ariaLabel={`Kasus ${d.short} tingkat kota ${values.length} minggu terakhir, garis putus-putus menunjukkan ambang`}
          />
          <figcaption className="mt-0.5 text-right text-[11px] leading-5 text-muted">{values.length} minggu terakhir</figcaption>
        </figure>
      </div>
      <p className="mt-2 text-[13px] leading-5 text-ink-2">
        ambang {fmtThreshold(city.threshold)} · rata-rata historis {fmtThreshold(city.expected)}
      </p>

      <div className="mt-4">
        <LevelBreakdown counts={counts} total={ds.kelurahanIds.length} />
      </div>

      <p className="mt-4 flex items-start gap-1.5 border-t border-line pt-3 text-[13px] leading-5 text-ink-2">
        <OutlookIcon size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
        <span>
          <span className="font-semibold text-ink">{OUTLOOK_LABEL}:</span> {outlookPhrase(city, cityForecast)}
        </span>
      </p>
    </article>
  );
}

interface StatusCardsProps {
  ds: Dataset;
  summaries: Record<DiseaseId, DiseaseSummary>;
  weekIndex: number;
  disease: DiseaseId;
  onSelectDisease: (d: DiseaseId) => void;
}

/** Bagian A: status tiga penyakit tingkat kota. Kartu sekaligus menjadi pemilih penyakit halaman. */
export function StatusCards({ ds, summaries, weekIndex, disease, onSelectDisease }: StatusCardsProps) {
  return (
    <section aria-label="Status tiga penyakit minggu ini" className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {DISEASE_IDS.map((id) => (
        <StatusCard
          key={id}
          ds={ds}
          summary={summaries[id]}
          weekIndex={weekIndex}
          active={id === disease}
          onSelect={() => onSelectDisease(id)}
        />
      ))}
    </section>
  );
}
