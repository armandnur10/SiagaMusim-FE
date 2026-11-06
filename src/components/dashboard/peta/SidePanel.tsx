'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { ArrowRight, Info, ShieldCheck, X } from 'lucide-react';
import { useMemo } from 'react';
import { RainCaseChart } from '@/components/charts';
import { DiseaseTag, LevelBadge, LevelDot } from '@/components/ui';
import { CITY_NAME, DISEASES, DISEASE_IDS, LEVELS, LEVEL_ORDER, rainIntensityLabel } from '@/lib/config';
import { assessMany, baselineSeries, countByLevel } from '@/lib/engines/risk';
import { fmtDec, fmtInt, fmtRain, fmtWeekLong, fmtWeekShort } from '@/lib/format';
import { assessRegionAll, rankAssessments } from '@/lib/summary';
import type { AlertLevel, Dataset, DiseaseId } from '@/types/ews';

const TOP_N = 6;
const CHART_WEEKS = 26;
const LEVELS_HIGH_TO_LOW: AlertLevel[] = [...LEVEL_ORDER].reverse();

/** Kasus harapan/ambang bisa pecahan: satu desimal, dibulatkan bila sudah ratusan. */
const fmtCases = (v: number): string => (Math.abs(v) >= 100 ? fmtInt(v) : fmtDec(v, 1));

function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="mb-2">
      <h3 className="text-[13px] font-bold leading-5 text-ink">{children}</h3>
      {note && <p className="text-[12px] leading-4 text-muted">{note}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tanpa pilihan: ringkasan tampilan + daftar prioritas
// ---------------------------------------------------------------------------
interface OverviewProps {
  dataset: Dataset;
  disease: DiseaseId;
  weekIndex: number;
  focusKecamatanId: string | null;
  onSelect: (id: string) => void;
}

export function OverviewPanel({ dataset: ds, disease, weekIndex, focusKecamatanId, onSelect }: OverviewProps) {
  const d = DISEASES[disease];
  const week = ds.weeks[weekIndex];
  const scopeId = focusKecamatanId ?? ds.cityId;
  const scope = ds.regions[scopeId];

  const { counts, top, elevated, total } = useMemo(() => {
    const ids = focusKecamatanId ? ds.regions[focusKecamatanId].childIds : ds.kelurahanIds;
    const list = assessMany(ds, ids, disease, weekIndex);
    const notNormal = rankAssessments(list).filter((a) => a.level !== 'normal');
    return { counts: countByLevel(list), top: notNormal.slice(0, TOP_N), elevated: notNormal.length, total: list.length };
  }, [ds, disease, weekIndex, focusKecamatanId]);

  const scopeCases = ds.series[scopeId].cases[disease][weekIndex];
  const scopeRain = ds.series[scopeId].rain[weekIndex];

  return (
    <div className="p-4 sm:p-5">
      <header>
        <p className="eyebrow">Ringkasan tampilan</p>
        <h2 className="mt-1 text-[18px] font-extrabold leading-6 tracking-tight text-ink">
          {focusKecamatanId ? `Kec. ${scope.name}` : CITY_NAME}
        </h2>
        <p className="num mt-0.5 text-[13px] leading-5 text-ink-2">
          {d.short} · {fmtWeekLong(week)}
        </p>
      </header>

      {/* Proporsi kelurahan per level (rinciannya ada pada baris berlabel di bawah). */}
      <div aria-hidden className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full">
        {LEVELS_HIGH_TO_LOW.map((id) =>
          counts[id] > 0 ? <span key={id} className="h-full" style={{ flexGrow: counts[id], flexBasis: 0, backgroundColor: LEVELS[id].color }} /> : null,
        )}
      </div>
      <dl className="mt-2.5">
        {LEVELS_HIGH_TO_LOW.map((id) => (
          <div key={id} className="flex h-[30px] items-center gap-2.5 border-b border-line last:border-0">
            <LevelDot level={id} />
            <dt className="text-[13px] font-semibold text-ink">{LEVELS[id].label}</dt>
            <dd className="ml-auto text-[13px] text-ink-2">
              <span className={clsx('num text-[14px] font-bold', counts[id] > 0 ? 'text-ink' : 'text-muted')}>{fmtInt(counts[id])}</span> kelurahan
            </dd>
          </div>
        ))}
      </dl>

      <dl className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <dt className="text-[12px] font-semibold leading-4 text-muted">Kasus {d.short}</dt>
          <dd className="num mt-0.5 text-[18px] font-extrabold leading-6 tracking-tight text-ink">{fmtInt(scopeCases)}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <dt className="text-[12px] font-semibold leading-4 text-muted">Hujan rata-rata</dt>
          <dd className="num mt-0.5 text-[18px] font-extrabold leading-6 tracking-tight text-ink">{fmtRain(scopeRain)}</dd>
        </div>
      </dl>

      <section className="mt-5">
        <SectionTitle note={top.length > 0 ? 'Level terberat lebih dulu. Pilih untuk melihat rinciannya.' : undefined}>Paling perlu perhatian</SectionTitle>
        {top.length === 0 ? (
          <div className="rounded-xl bg-surface-2 px-4 py-5 text-center">
            <ShieldCheck aria-hidden size={22} strokeWidth={1.75} className="mx-auto text-ink-2" />
            <p className="mt-2 text-[14px] font-bold text-ink">Semua kelurahan berstatus Normal</p>
            <p className="mx-auto mt-1 max-w-[260px] text-[13px] leading-5 text-ink-2">
              Tidak ada kelurahan yang perlu perhatian khusus untuk {d.short} pada minggu ke-{week.isoWeek} tahun {week.isoYear}.
            </p>
          </div>
        ) : (
          <>
            <ul className="-mx-2">
              {top.map((a) => {
                const r = ds.regions[a.regionId];
                return (
                  <li key={a.regionId}>
                    <button
                      type="button"
                      onClick={() => onSelect(a.regionId)}
                      className="flex min-h-[48px] w-full items-center gap-3 rounded-[10px] px-2 py-1 text-left hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold leading-5 text-ink">{r.name}</span>
                        <span className="block truncate text-[12px] leading-4 text-muted">Kec. {r.kecamatan}</span>
                      </span>
                      <span className="num shrink-0 text-[13px] text-ink-2">
                        <span className="font-bold text-ink">{fmtInt(a.cases)}</span> kasus
                      </span>
                      <LevelBadge level={a.level} size="sm" className="w-[86px] shrink-0 justify-center" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {elevated > top.length && (
              <p className="mt-2 text-[12px] leading-4 text-muted">
                {fmtInt(elevated - top.length)} kelurahan lain di atas Normal, dari {fmtInt(total)} kelurahan.
              </p>
            )}
          </>
        )}
        <Link href="/dashboard/wilayah" className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline">
          Lihat semua wilayah
          <ArrowRight size={15} aria-hidden />
        </Link>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kelurahan terpilih
// ---------------------------------------------------------------------------
interface KelurahanProps {
  dataset: Dataset;
  regionId: string;
  disease: DiseaseId;
  weekIndex: number;
  onDiseaseChange: (d: DiseaseId) => void;
  onClose: () => void;
}

function Fact({ label, value, note }: { label: string; value: React.ReactNode; note: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2">
      <dt className="truncate text-[12px] font-semibold leading-4 text-muted">{label}</dt>
      <dd className="num mt-0.5 truncate text-[18px] font-extrabold leading-6 tracking-tight text-ink">{value}</dd>
      <dd className="num truncate text-[12px] leading-4 text-ink-2">{note}</dd>
    </div>
  );
}

export function KelurahanPanel({ dataset: ds, regionId, disease, weekIndex, onDiseaseChange, onClose }: KelurahanProps) {
  const region = ds.regions[regionId];
  const d = DISEASES[disease];
  const week = ds.weeks[weekIndex];
  const { byDisease } = useMemo(() => assessRegionAll(ds, regionId, weekIndex), [ds, regionId, weekIndex]);
  const a = byDisease[disease];
  const series = ds.series[regionId];
  const baseline = useMemo(() => baselineSeries(ds, regionId, disease), [ds, regionId, disease]);
  const from = Math.max(0, weekIndex - (CHART_WEEKS - 1));
  const above = a.cases > a.threshold;

  return (
    <>
      <div className="flex-1 p-4 sm:p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Kelurahan terpilih</p>
            <h2 className="mt-1 text-[18px] font-extrabold leading-6 tracking-tight text-ink">{region.name}</h2>
            <p className="num mt-0.5 text-[13px] leading-5 text-ink-2">
              Kec. {region.kecamatan} · {fmtInt(region.population)} penduduk
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1.5 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-ink-2 hover:bg-surface-2 hover:text-ink"
            aria-label="Tutup rincian kelurahan"
            title="Tutup (Esc)"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="mt-4 grid gap-1" role="group" aria-label={`Status tiga penyakit di ${region.name}, ${fmtWeekLong(week)}`}>
          {DISEASE_IDS.map((id) => {
            const x = byDisease[id];
            const current = id === disease;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={current}
                onClick={() => onDiseaseChange(id)}
                className={clsx(
                  'flex min-h-[40px] w-full items-center gap-3 rounded-[10px] border px-3 text-left',
                  current ? 'border-line-strong bg-surface-2' : 'border-transparent hover:bg-surface-2',
                )}
              >
                <DiseaseTag disease={id} className="min-w-0 flex-1" />
                <span className="num shrink-0 text-[13px] text-ink-2">
                  <span className="font-bold text-ink">{fmtInt(x.cases)}</span> kasus
                </span>
                <LevelBadge level={x.level} size="sm" className="w-[86px] shrink-0 justify-center" />
              </button>
            );
          })}
        </div>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold leading-5 text-ink">Rincian {d.short}</h3>
              <p className="num text-[12px] leading-4 text-muted">Skor risiko {fmtInt(a.score)} dari 100</p>
            </div>
            <LevelBadge level={a.level} className="shrink-0" />
          </div>
          <dl className="grid grid-cols-3 gap-2">
            <Fact label="Kasus baru" value={fmtInt(a.cases)} note={`ambang ${fmtCases(a.threshold)}`} />
            <Fact label="Insidensi" value={fmtDec(a.incidenceRate, 1)} note="per 100 rb" />
            <Fact label="Hujan" value={fmtRain(a.rainThisWeek)} note={rainIntensityLabel(a.rainThisWeek)} />
          </dl>
          <p className="mt-2 text-[12.5px] leading-[18px] text-ink-2">
            Kasus {above ? 'melampaui' : 'belum melampaui'} ambang historis; pada minggu seperti ini biasanya sekitar {fmtCases(a.expected)} kasus.
          </p>
        </section>

        <section className="mt-4">
          <SectionTitle>Mengapa level ini</SectionTitle>
          <ul className="grid gap-1.5">
            {a.drivers.map((text) => (
              <li key={text} className="flex gap-2 text-[13px] leading-5 text-ink">
                <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-ink-2" />
                {text}
              </li>
            ))}
          </ul>
          {a.ruleNote && (
            <p className="mt-2.5 flex gap-2 rounded-[10px] bg-surface-2 px-3 py-2 text-[12.5px] leading-[18px] text-ink-2">
              <Info size={15} aria-hidden className="mt-px shrink-0" />
              {a.ruleNote}
            </p>
          )}
        </section>

        <section className="mt-4">
          <SectionTitle note={`Hujan (atas) dan kasus ${d.short} (bawah), ${fmtWeekShort(ds.weeks[from])} ${ds.weeks[from].isoYear} – ${fmtWeekShort(week)} ${week.isoYear}`}>
            {fmtInt(weekIndex - from + 1)} minggu terakhir
          </SectionTitle>
          <RainCaseChart
            weeks={ds.weeks}
            rain={series.rain}
            cases={series.cases[disease]}
            disease={disease}
            range={{ from, to: weekIndex }}
            expected={baseline.expected}
            threshold={baseline.threshold}
            selectedWeek={weekIndex}
            showLagWindow={false}
            height={190}
            compact
          />
        </section>
      </div>

      <div className="rounded-b-card border-t border-line bg-surface p-4 sm:px-5 lg:sticky lg:bottom-0">
        <Link href={`/dashboard/wilayah/${regionId}`} className="btn btn-primary w-full">
          Buka profil lengkap
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </>
  );
}
