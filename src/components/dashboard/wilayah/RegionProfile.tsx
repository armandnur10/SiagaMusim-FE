'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Info, MapPinOff, TriangleAlert } from 'lucide-react';
import { LevelStrip, RainCaseChart } from '@/components/charts';
import { PageHeader } from '@/components/shell';
import { Card, CardHeader, DataGate, DiseaseTag, LevelBadge, RecommendationList, ScoreScale, SignalBreakdown } from '@/components/ui';
import { CITY_NAME, DISEASES, DISEASE_IDS, FORECAST_HORIZON, LEVELS, rainIntensityLabel } from '@/lib/config';
import { useDataset } from '@/lib/data/EwsDataProvider';
import { forecast } from '@/lib/engines/forecast';
import { assess, assessMany, baselineSeries, levelHistory } from '@/lib/engines/risk';
import { fmtDateShort, fmtDec, fmtInt, fmtRain, fmtWeekLong, fmtWeekRange } from '@/lib/format';
import { useFilters } from '@/lib/state/filters';
import { rankAssessments } from '@/lib/summary';
import type { Assessment, Dataset, DiseaseId, Forecast, RegionInfo } from '@/types/ews';
import { fmtCases, forecastSentence, isAboveThreshold, regionHref, regionTitle } from './shared';

type RangePreset = '26' | '52' | 'semua';
const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: '26', label: '26 minggu' },
  { id: '52', label: '52 minggu' },
  { id: 'semua', label: 'Semua' },
];
const HISTORY_WEEKS = 52;
const CITY_CHILD_LIMIT = 10;

const addDays = (iso: string, days: number): string => {
  const dt = new Date(iso + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

/** Rentang Senin–Minggu ringkas: "2–8 Nov", atau "29 Jun – 5 Jul" bila melintasi bulan. */
const fmtDayRange = (start: string): string => {
  const end = addDays(start, 6);
  return start.slice(0, 7) === end.slice(0, 7) ? `${Number(start.slice(8, 10))}–${fmtDateShort(end)}` : `${fmtDateShort(start)} – ${fmtDateShort(end)}`;
};

// ---------------------------------------------------------------------------
// Tidak ditemukan
// ---------------------------------------------------------------------------
function RegionNotFound({ id }: { id: string }) {
  let shown = id;
  try {
    shown = decodeURIComponent(id);
  } catch {
    /* biarkan apa adanya */
  }
  if (shown.length > 60) shown = shown.slice(0, 60) + '…';
  return (
    <div className="card mx-auto my-10 max-w-lg p-6 text-center">
      <MapPinOff className="mx-auto mb-3 text-ink-2" size={28} aria-hidden />
      <h1 className="text-[18px] font-bold text-ink">Wilayah tidak ditemukan</h1>
      <p className="mt-1.5 break-words text-[14px] leading-6 text-ink-2">
        Tidak ada kelurahan atau kecamatan dengan kode <code className="font-mono text-[13px] text-ink">{shown}</code>. Periksa kembali
        tautannya, atau pilih wilayah dari daftar.
      </p>
      <Link href="/dashboard/wilayah" className="btn btn-primary mt-4">
        Lihat daftar wilayah
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kepala profil
// ---------------------------------------------------------------------------
function Crumbs({ ds, region }: { ds: Dataset; region: RegionInfo }) {
  const parent =
    region.kind === 'kelurahan' && region.kecamatanId
      ? ds.regions[region.kecamatanId]
      : region.kind === 'kecamatan'
        ? ds.regions[ds.cityId]
        : null;
  const linkCls = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-md font-semibold text-ink-2 hover:text-ink';
  return (
    <nav aria-label="Jejak navigasi" className="-mt-2 mb-1">
      <ol className="flex flex-wrap items-center gap-x-1.5 text-[13px]">
        <li>
          <Link href="/dashboard/wilayah" className={linkCls}>
            <ArrowLeft size={15} aria-hidden />
            Wilayah
          </Link>
        </li>
        {parent && (
          <li className="flex items-center gap-1.5">
            <ChevronRight size={14} className="text-muted" aria-hidden />
            <Link href={regionHref(parent.id)} className={linkCls}>
              {regionTitle(parent)}
            </Link>
          </li>
        )}
        <li className="flex min-h-[40px] items-center gap-1.5 text-muted" aria-current="page">
          <ChevronRight size={14} aria-hidden />
          {regionTitle(region)}
        </li>
      </ol>
    </nav>
  );
}

function Fact({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[13px] text-muted">{label}</span>
      <strong className="num text-[14px] font-bold text-ink">{value}</strong>
      <span className="text-[13px] text-ink-2">{unit}</span>
    </span>
  );
}

function ProfileHeader({ ds, region }: { ds: Dataset; region: RegionInfo }) {
  const density = region.areaKm2 > 0 ? region.population / region.areaKm2 : 0;
  const kec = region.kecamatanId ? ds.regions[region.kecamatanId] : null;
  return (
    <PageHeader
      title={regionTitle(region)}
      description={
        <>
          <span className="block">
            {region.kind === 'kelurahan' && (
              <>
                Kelurahan ·{' '}
                {kec ? (
                  <Link href={regionHref(kec.id)} className="rounded font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                    Kec. {kec.name}
                  </Link>
                ) : (
                  `Kec. ${region.kecamatan ?? ''}`
                )}
                {' · '}
                {CITY_NAME}
              </>
            )}
            {region.kind === 'kecamatan' && (
              <>
                Kecamatan · {CITY_NAME} · {fmtInt(region.childIds.length)} kelurahan
              </>
            )}
            {region.kind === 'kota' && (
              <>
                Kota administrasi · {fmtInt(ds.kecamatanIds.length)} kecamatan · {fmtInt(region.childIds.length)} kelurahan
              </>
            )}
          </span>
          <span className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            <Fact label="Penduduk" value={fmtInt(region.population)} unit="jiwa" />
            <Fact label="Luas" value={fmtDec(region.areaKm2, 2)} unit="km²" />
            <Fact label="Kepadatan" value={fmtInt(density)} unit="jiwa/km²" />
          </span>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Tiga kartu status penyakit
// ---------------------------------------------------------------------------
function DiseaseStatusCards({
  byDisease,
  active,
  onPick,
}: {
  byDisease: Record<DiseaseId, Assessment>;
  active: DiseaseId;
  onPick: (d: DiseaseId) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="Status per penyakit">
      {DISEASE_IDS.map((id) => {
        const a = byDisease[id];
        const on = id === active;
        const above = isAboveThreshold(a);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            aria-label={`${DISEASES[id].name}: ${LEVELS[a.level].label}, ${fmtInt(a.cases)} kasus minggu ini, ambang ${fmtCases(a.threshold)}${on ? ' (sedang ditampilkan)' : ''}`}
            onClick={() => onPick(id)}
            className={clsx(
              'card flex min-w-0 flex-col p-3 text-left transition-colors sm:p-4',
              on ? 'border-ink shadow-[inset_0_0_0_1px_var(--ink),var(--shadow-card)]' : 'hover:border-line-strong hover:bg-surface-2',
            )}
          >
            {/* Ponsel: tiga kartu ringkas berdampingan; ≥ sm: kartu penuh dengan kalimat pemicu. */}
            <span className="flex w-full flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <DiseaseTag disease={id} className="sm:text-[14px]" />
              <LevelBadge level={a.level} size="sm" />
            </span>
            <span className="mt-2.5 flex items-baseline gap-1.5 sm:mt-3">
              <span className="num text-[24px] font-extrabold leading-7 tracking-tight text-ink sm:text-[28px] sm:leading-8">{fmtInt(a.cases)}</span>
              <span className="text-[13px] font-medium text-ink-2">
                kasus<span className="hidden sm:inline"> minggu ini</span>
              </span>
            </span>
            <span className="num mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] leading-4 text-ink-2 sm:text-[13px] sm:leading-5">
              <span className={clsx(above && 'font-semibold text-ink')}>
                {above && (
                  <TriangleAlert size={13} strokeWidth={2.5} className="-mt-0.5 mr-1 inline-block" style={{ color: LEVELS.siaga.colorText }} aria-hidden />
                )}
                {above ? 'Di atas ambang' : 'Ambang'} {fmtCases(a.threshold)}
              </span>
              <span className="hidden text-muted sm:inline">· skor {fmtInt(a.score)}</span>
            </span>
            <span className="mt-2 hidden text-[13px] leading-5 text-ink-2 sm:block">{a.drivers[0]}</span>
            <span className={clsx('mt-auto hidden items-center gap-1 pt-3 text-[12px] font-semibold sm:flex', on ? 'text-ink' : 'text-muted')}>
              {on ? (
                <>
                  <Check size={13} strokeWidth={2.75} aria-hidden />
                  Sedang ditampilkan
                </>
              ) : (
                <>
                  Lihat rincian
                  <ChevronRight size={13} strokeWidth={2.5} aria-hidden />
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bacaan singkat di bawah grafik
// ---------------------------------------------------------------------------
function buildReading(a: Assessment, f: Forecast, disease: DiseaseId): { label: string; text: string }[] {
  const d = DISEASES[disease];
  const thr = fmtCases(a.threshold);
  const avg = `rata-rata historis minggu yang sama ${fmtCases(a.expected)}`;
  let kasus: string;
  if (isAboveThreshold(a)) {
    kasus =
      a.weeksAboveThreshold >= 2
        ? `${fmtInt(a.cases)} kasus minggu ini, di atas ambang ${thr} selama ${a.weeksAboveThreshold} minggu berturut-turut (${avg}).`
        : `${fmtInt(a.cases)} kasus minggu ini, di atas ambang ${thr} (${avg}).`;
  } else if (a.cases > a.expected * 1.15 && a.cases - a.expected >= 1) {
    kasus = `${fmtInt(a.cases)} kasus minggu ini, di atas ${avg} tetapi masih di bawah ambang ${thr}.`;
  } else {
    kasus = `${fmtInt(a.cases)} kasus minggu ini, di bawah ambang ${thr} (${avg}).`;
  }

  const ratio = a.rainExposureNormal > 0 ? a.rainExposure / a.rainExposureNormal : 1;
  const now = `${fmtRain(a.rainThisWeek)} minggu ini (${rainIntensityLabel(a.rainThisWeek).toLowerCase()}).`;
  let hujan: string;
  if (ratio >= 1.15) {
    hujan = `${now} Hujan beberapa minggu terakhir ${fmtDec(ratio, 1)}× normal musimnya; dampaknya pada kasus ${d.short} biasanya terlihat ${d.lagLabel} setelah hujan.`;
  } else if (ratio <= 0.85) {
    hujan = `${now} Hujan beberapa minggu terakhir di bawah normal musimnya.`;
  } else {
    hujan = `${now} Hujan beberapa minggu terakhir setara normal musimnya.`;
  }

  return [
    { label: 'Kasus', text: kasus },
    { label: 'Hujan', text: hujan },
    { label: `Proyeksi ${FORECAST_HORIZON} minggu`, text: forecastSentence(a, f) },
  ];
}

// ---------------------------------------------------------------------------
// Wilayah terkait
// ---------------------------------------------------------------------------
function RelatedRegions({ ds, region, disease, weekIndex, className }: { ds: Dataset; region: RegionInfo; disease: DiseaseId; weekIndex: number; className?: string }) {
  const d = DISEASES[disease];
  const isKelurahan = region.kind === 'kelurahan';
  const kec = isKelurahan && region.kecamatanId ? ds.regions[region.kecamatanId] : null;

  const ranked = useMemo(() => {
    const ids = isKelurahan ? (kec?.childIds ?? []).filter((cid) => cid !== region.id) : region.childIds;
    return rankAssessments(assessMany(ds, ids, disease, weekIndex));
  }, [ds, isKelurahan, kec, region, disease, weekIndex]);

  const limited = region.kind === 'kota' ? ranked.slice(0, CITY_CHILD_LIMIT) : ranked;
  const title = isKelurahan
    ? `Kelurahan lain di Kec. ${region.kecamatan ?? ''}`
    : region.kind === 'kota'
      ? `${fmtInt(limited.length)} kelurahan paling perlu perhatian`
      : `Kelurahan di ${regionTitle(region)}`;

  return (
    <Card flush className={className}>
      <div className="p-4 pb-0 sm:p-5 sm:pb-0">
        <CardHeader title={title} subtitle={`${d.short}, urut dari yang paling perlu perhatian.`} className="mb-3" />
      </div>
      {limited.length === 0 ? (
        <p className="px-4 pb-4 text-[13px] text-ink-2 sm:px-5 sm:pb-5">Tidak ada kelurahan lain di kecamatan ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-y border-line bg-surface-2 text-[12px] font-bold text-ink-2">
                <th scope="col" className="py-2 pl-4 pr-2 sm:pl-5">Kelurahan</th>
                <th scope="col" className="px-2 py-2">Level</th>
                <th scope="col" className="px-2 py-2 text-right">Kasus</th>
                <th scope="col" className="py-2 pl-2 pr-4 text-right sm:pr-5">
                  <abbr title="Kasus per 100.000 penduduk" className="whitespace-nowrap no-underline">/100 rb</abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {limited.map((a) => (
                <tr key={a.regionId} className="border-b border-line hover:bg-surface-2">
                  <th scope="row" className="py-0 pl-4 pr-2 text-left font-normal sm:pl-5">
                    <Link href={regionHref(a.regionId)} className="flex min-h-[44px] items-center py-1.5 font-semibold leading-4 text-ink underline-offset-2 hover:underline">
                      {ds.regions[a.regionId].name}
                    </Link>
                  </th>
                  <td className="px-2 py-1.5">
                    <LevelBadge level={a.level} size="sm" />
                  </td>
                  <td className={clsx('num px-2 py-1.5 text-right text-ink', isAboveThreshold(a) && 'font-bold')}>{fmtInt(a.cases)}</td>
                  <td className="num py-1.5 pl-2 pr-4 text-right text-ink-2 sm:pr-5">{fmtDec(a.incidenceRate, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-4 py-3 sm:px-5">
        {kec ? (
          <Link href={regionHref(kec.id)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md text-[13px] font-semibold text-brand hover:text-brand-strong">
            Profil Kec. {kec.name}
            <ArrowRight size={14} aria-hidden />
          </Link>
        ) : (
          <Link href="/dashboard/wilayah" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md text-[13px] font-semibold text-brand hover:text-brand-strong">
            {region.kind === 'kota' ? `Lihat semua ${fmtInt(region.childIds.length)} kelurahan` : 'Bandingkan dengan semua wilayah'}
            <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Isi profil
// ---------------------------------------------------------------------------
function ProfileContent({ id }: { id: string }) {
  const ds = useDataset();
  const region: RegionInfo | undefined = Object.prototype.hasOwnProperty.call(ds.regions, id) ? ds.regions[id] : undefined;
  if (!region) return <RegionNotFound id={id} />;
  return <ProfileBody ds={ds} region={region} />;
}

function ProfileBody({ ds, region }: { ds: Dataset; region: RegionInfo }) {
  const { disease, setDisease, weekIndex, week, setWeekIndex } = useFilters();
  const [preset, setPreset] = useState<RangePreset>('52');
  const id = region.id;
  const d = DISEASES[disease];

  const byDisease = useMemo(
    () => ({
      dbd: assess(ds, id, 'dbd', weekIndex),
      muntaber: assess(ds, id, 'muntaber', weekIndex),
      influenza: assess(ds, id, 'influenza', weekIndex),
    }),
    [ds, id, weekIndex],
  );
  const a = byDisease[disease];
  const f = useMemo(() => forecast(ds, id, disease, weekIndex), [ds, id, disease, weekIndex]);
  const baseline = useMemo(() => baselineSeries(ds, id, disease), [ds, id, disease]);
  const series = ds.series[id];

  const range = useMemo(
    () => ({ from: preset === 'semua' ? 0 : Math.max(0, weekIndex - Number(preset) + 1), to: weekIndex }),
    [preset, weekIndex],
  );

  const history = useMemo(() => {
    const from = Math.max(0, weekIndex - HISTORY_WEEKS + 1);
    const levels = levelHistory(ds, id, disease, from, weekIndex);
    let elevated = 0;
    let waspada = 0;
    for (const lv of levels) {
      if (lv === 'siaga' || lv === 'awas') elevated++;
      else if (lv === 'waspada') waspada++;
    }
    return { from, levels, weeks: ds.weeks.slice(from, weekIndex + 1), elevated, waspada };
  }, [ds, id, disease, weekIndex]);

  const reading = useMemo(() => buildReading(a, f, disease), [a, f, disease]);
  const weekLabel = week ? fmtWeekLong(week) : '';
  const levelCfg = LEVELS[a.level];

  return (
    <>
      <Crumbs ds={ds} region={region} />
      <ProfileHeader ds={ds} region={region} />

      <div className="grid grid-cols-1 gap-5">
        <DiseaseStatusCards byDisease={byDisease} active={disease} onPick={setDisease} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:items-start">
          {/* Kolom utama (di ponsel: anak-anaknya ikut grid induk dan diurutkan dengan order-*) */}
          <div className="contents xl:col-span-2 xl:grid xl:grid-cols-1 xl:gap-5">
            {/* Apa yang terjadi */}
            <Card className="order-1">
              <CardHeader
                title={`Hujan dan kasus ${d.short}`}
                subtitle={
                  <span className="block max-w-[46ch]">
                    Per minggu, sampai {weekLabel}. Kasus biasanya naik {d.lagLabel} setelah hujan.
                  </span>
                }
                action={
                  <div className="segmented" role="group" aria-label="Rentang waktu grafik">
                    {RANGE_PRESETS.map((p) => (
                      <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                }
              />
              <div className="min-w-0">
                <RainCaseChart
                  weeks={ds.weeks}
                  rain={series.rain}
                  cases={series.cases[disease]}
                  disease={disease}
                  range={range}
                  expected={baseline.expected}
                  threshold={baseline.threshold}
                  forecast={f.points}
                  selectedWeek={weekIndex}
                />
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-line pt-4 md:grid-cols-3">
                {reading.map((r) => (
                  <div key={r.label} className="min-w-0">
                    <dt className="eyebrow">{r.label}</dt>
                    <dd className="mt-1 text-[13px] leading-5 text-ink">{r.text}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            {/* Apa berikutnya */}
            <Card flush className="order-3">
              <div className="p-4 pb-0 sm:p-5 sm:pb-0">
                <CardHeader title={`Proyeksi ${FORECAST_HORIZON} minggu`} subtitle={forecastSentence(a, f)} className="mb-3" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-y border-line bg-surface-2 text-[12px] font-bold text-ink-2">
                      <th scope="col" className="py-2.5 pl-4 pr-3 sm:pl-5">Minggu</th>
                      <th scope="col" className="px-2 py-2.5 text-right sm:px-3">Perkiraan kasus</th>
                      <th scope="col" className="px-2 py-2.5 text-right sm:px-3">Rentang</th>
                      <th scope="col" className="py-2.5 pl-2 pr-4 text-right sm:px-3">Ambang</th>
                      <th scope="col" className="hidden py-2.5 pl-3 pr-4 sm:table-cell sm:pr-5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.points.map((p) => {
                      const over = p.expected > p.threshold;
                      return (
                        <tr key={p.horizon} className="border-b border-line">
                          <th scope="row" className="whitespace-nowrap py-2.5 pl-4 pr-2 text-left font-normal sm:pl-5 sm:pr-3">
                            <span className="num font-semibold text-ink">Minggu ke-{p.isoWeek}</span>
                            <span className="num block text-[12px] leading-4 text-muted">
                              {fmtDayRange(p.date)}
                            </span>
                          </th>
                          <td className="px-2 py-2.5 text-right sm:px-3">
                            <span className={clsx('num block text-[14px] text-ink', over ? 'font-extrabold' : 'font-semibold')}>{fmtCases(p.expected)}</span>
                            {over && <span className="block text-[12px] font-semibold leading-4 text-ink-2 sm:hidden">di atas ambang</span>}
                          </td>
                          <td className="num whitespace-nowrap px-2 py-2.5 text-right text-ink-2 sm:px-3">
                            {fmtCases(p.low)} – {fmtCases(p.high)}
                          </td>
                          <td className="num py-2.5 pl-2 pr-4 text-right text-ink-2 sm:px-3">{fmtCases(p.threshold)}</td>
                          <td className="hidden whitespace-nowrap py-2.5 pl-3 pr-4 sm:table-cell sm:pr-5">
                            {over ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-ink">
                                <TriangleAlert size={13} strokeWidth={2.5} className="shrink-0" style={{ color: LEVELS.siaga.colorText }} aria-hidden />
                                Di atas ambang
                              </span>
                            ) : (
                              <span className="text-muted">Di bawah ambang</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="flex items-start gap-1.5 px-4 py-3 text-[12px] leading-4 text-muted sm:px-5">
                <Info size={13} className="mt-px shrink-0" aria-hidden />
                Proyeksi indikatif, bukan prediksi tervalidasi.
              </p>
            </Card>

            {/* Riwayat */}
            <Card className="order-4">
              <CardHeader
                title="Riwayat status"
                subtitle={`Level ${d.short} tiap minggu selama ${fmtInt(history.levels.length)} minggu sampai ${weekLabel}. Klik satu minggu untuk melihat kondisi pada minggu itu.`}
              />
              <div className="min-w-0">
                <LevelStrip
                  levels={history.levels}
                  weeks={history.weeks}
                  selectedIndex={history.levels.length - 1}
                  onSelect={(i) => setWeekIndex(history.from + i)}
                  cellHeight={24}
                  showLegend
                />
              </div>
              <p className="mt-3 text-[13px] leading-5 text-ink-2">
                Dalam periode ini: <strong className="num font-semibold text-ink">{fmtInt(history.elevated)} minggu</strong> berstatus Siaga atau Awas dan{' '}
                <strong className="num font-semibold text-ink">{fmtInt(history.waspada)} minggu</strong> Waspada.
              </p>
            </Card>
          </div>

          {/* Kolom samping */}
          <div className="contents xl:grid xl:grid-cols-1 xl:gap-5">
            {/* Mengapa */}
            <Card className="order-2">
              <CardHeader title="Mengapa level ini" subtitle={week ? `${d.short} · ${weekLabel} (${fmtWeekRange(week)})` : d.short} />
              <div className="flex items-center justify-between gap-3">
                <LevelBadge level={a.level} size="lg" />
                <p className="text-right leading-none">
                  <span className="eyebrow block">Skor risiko</span>
                  <span className="num text-[28px] font-extrabold leading-8 tracking-tight text-ink">{fmtInt(a.score)}</span>
                  <span className="text-[13px] font-medium text-muted"> / 100</span>
                </p>
              </div>
              <p className="mt-3 text-[14px] leading-6 text-ink-2">{levelCfg.meaning}</p>
              <ScoreScale score={a.score} className="mt-4" />

              {a.ruleNote && (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-5 text-ink-2">
                  <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
                  <span>{a.ruleNote}</span>
                </p>
              )}

              <h3 className="mt-5 text-[13px] font-bold text-ink">Pemicu utama</h3>
              <ul className="mt-2 grid gap-1.5">
                {a.drivers.map((text) => (
                  <li key={text} className="flex items-start gap-2 text-[14px] leading-5 text-ink">
                    <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-2" />
                    {text}
                  </li>
                ))}
              </ul>

              <h3 className="mb-3 mt-5 text-[13px] font-bold text-ink">Tiga sinyal pembentuk skor</h3>
              <SignalBreakdown assessment={a} />

              <p className="mt-4 border-t border-line pt-2">
                <Link href="/metodologi" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md text-[13px] font-semibold text-brand hover:text-brand-strong">
                  Cara skor dihitung
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </p>
            </Card>

            {/* Apa yang perlu dilakukan */}
            <Card className="order-5">
              <CardHeader title="Tindakan yang disarankan" subtitle={`Untuk ${d.short} pada level ${levelCfg.label}.`} />
              <RecommendationList disease={disease} level={a.level} defaultAudience="dinas" />
              <p className="mt-4 text-[12px] leading-4 text-muted">Panduan umum, bukan pengganti protokol resmi Dinas Kesehatan.</p>
            </Card>

            <RelatedRegions ds={ds} region={region} disease={disease} weekIndex={weekIndex} className="order-6" />
          </div>
        </div>
      </div>
    </>
  );
}

export function RegionProfile({ id }: { id: string }) {
  return (
    <DataGate>
      <ProfileContent id={id} />
    </DataGate>
  );
}
