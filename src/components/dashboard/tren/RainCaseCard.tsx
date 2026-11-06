'use client';

import { useMemo, useState, useSyncExternalStore, type RefObject } from 'react';
import { ChartLine, Table2 } from 'lucide-react';
import { ChartLegend, LevelStrip, RainCaseChart, useElementWidth, type LegendItem } from '@/components/charts';
import { Card, CardHeader, LevelBadge } from '@/components/ui';
import { DISEASES, LEVELS, LEVEL_ORDER, RAIN } from '@/lib/config';
import { fmtDec, fmtInt, fmtWeekRange, fmtWeekShort } from '@/lib/format';
import type { AlertLevel, Dataset, DiseaseId, ForecastPoint } from '@/types/ews';
import { fmtCases, rainCaseInsets } from './helpers';

const LEVEL_LEGEND: LegendItem[] = LEVEL_ORDER.map((l) => ({ id: l, label: LEVELS[l].label, kind: 'rect', color: LEVELS[l].color }));

type View = 'grafik' | 'tabel';

interface RainCaseCardProps {
  ds: Dataset;
  regionId: string;
  regionName: string;
  disease: DiseaseId;
  range: { from: number; to: number };
  expected: number[];
  threshold: number[];
  /** Level peringatan untuk minggu `range.from..range.to`. */
  levels: AlertLevel[];
  forecast: ForecastPoint[];
  weekIndex: number;
  onSelectWeek: (weekIndex: number) => void;
  /** Jangkar gulir (dipakai panel "Bandingkan kecamatan" untuk kembali ke grafik ini). */
  anchorRef?: RefObject<HTMLDivElement | null>;
}

/** Tahun ISO sebuah minggu = tahun kalender hari Kamisnya (Senin + 3 hari). */
const isoYearOf = (monday: string): number => Number(addDays(monday, 3).slice(0, 4));

/** true bila perangkat punya pointer yang bisa "hover" (mouse/trackpad); false di layar sentuh murni. */
function useCanHover(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia('(hover: hover)');
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => window.matchMedia('(hover: hover)').matches,
    () => true,
  );
}

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Kartu utama: hujan (atas) dan kasus (bawah) pada satu sumbu waktu, dengan kembaran tabel. */
export function RainCaseCard({
  ds,
  regionId,
  regionName,
  disease,
  range,
  expected,
  threshold,
  levels,
  forecast,
  weekIndex,
  onSelectWeek,
  anchorRef,
}: RainCaseCardProps) {
  const d = DISEASES[disease];
  const [view, setView] = useState<View>('grafik');
  // Di layar sentuh, ketukan pada grafik dipakai untuk membaca nilai (tooltip + jendela jeda);
  // memilih minggu dilakukan lewat strip status atau penggeser minggu, agar rentang tidak bergeser tanpa sengaja.
  const canHover = useCanHover();
  const [bodyRef, bodyWidth] = useElementWidth<HTMLDivElement>();
  const series = ds.series[regionId];
  const rain = series.rain;
  const cases = series.cases[disease];
  const n = range.to - range.from + 1;

  const stripWeeks = useMemo(() => ds.weeks.slice(range.from, range.to + 1), [ds, range.from, range.to]);

  const insets = useMemo(
    () => rainCaseInsets({ rain, cases, expected, threshold, from: range.from, to: range.to, forecast }),
    [rain, cases, expected, threshold, range.from, range.to, forecast],
  );

  const summary = useMemo(() => {
    let above = 0;
    let extreme = 0;
    for (let i = range.from; i <= range.to; i++) {
      if (cases[i] > threshold[i]) above++;
      if (rain[i] >= RAIN.extremeWeekly) extreme++;
    }
    return { above, extreme };
  }, [cases, rain, threshold, range.from, range.to]);

  const chartHeight = bodyWidth > 0 && bodyWidth < 560 ? 340 : 420;

  return (
    <div ref={anchorRef} id="grafik-utama" className="min-w-0 scroll-mt-24">
    <Card>
      <CardHeader
        title={`Hujan dan kasus ${d.short}`}
        subtitle={
          view === 'grafik'
            ? `Kasus ${d.short} biasanya mengikuti hujan ${d.lagLabel} sebelumnya; ${canHover ? 'arahkan kursor ke grafik' : 'sentuh grafik'} untuk melihat hujan pemicunya.`
            : `Angka yang sama dengan grafik, minggu terbaru di atas. ${regionName}, ${fmtInt(n)} minggu teramati dan ${fmtInt(forecast.length)} minggu proyeksi.`
        }
        action={
          <div className="segmented" role="group" aria-label="Tampilan data">
            <button type="button" aria-pressed={view === 'grafik'} className="!min-h-10 sm:!min-h-[34px]" onClick={() => setView('grafik')}>
              <ChartLine size={15} aria-hidden />
              Grafik
            </button>
            <button type="button" aria-pressed={view === 'tabel'} className="!min-h-10 sm:!min-h-[34px]" onClick={() => setView('tabel')}>
              <Table2 size={15} aria-hidden />
              Tabel
            </button>
          </div>
        }
      />

      <div ref={bodyRef} className="min-w-0">
        {view === 'grafik' ? (
          <>
            <RainCaseChart
              weeks={ds.weeks}
              rain={rain}
              cases={cases}
              disease={disease}
              range={range}
              expected={expected}
              threshold={threshold}
              forecast={forecast}
              selectedWeek={weekIndex}
              onSelectWeek={canHover ? onSelectWeek : undefined}
              height={chartHeight}
            />
            <p className="mt-3 text-[13px] leading-5 text-ink-2">
              Dalam {fmtInt(n)} minggu yang ditampilkan, kasus berada di atas ambang pada{' '}
              <strong className="font-semibold text-ink">{fmtInt(summary.above)} minggu</strong> dan hujan ekstrem (≥ {fmtInt(RAIN.extremeWeekly)}{' '}
              mm) terjadi pada <strong className="font-semibold text-ink">{fmtInt(summary.extreme)} minggu</strong>. Bagian berlatar abu-abu di
              kanan adalah proyeksi indikatif, bukan data teramati.
            </p>

            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <h3 className="text-[14px] font-bold leading-5 text-ink">Riwayat status</h3>
                <ChartLegend items={LEVEL_LEGEND} />
              </div>
              <div
                style={{
                  paddingLeft: insets.left,
                  paddingRight: `calc(${insets.right}px + (100% - ${insets.left + insets.right}px) * ${insets.futureShare.toFixed(5)})`,
                }}
              >
                <LevelStrip
                  levels={levels}
                  weeks={stripWeeks}
                  selectedIndex={weekIndex - range.from}
                  onSelect={(i) => onSelectWeek(range.from + i)}
                />
              </div>
              <p className="mt-1.5 text-[13px] leading-5 text-ink-2">
                Tiap kotak adalah satu minggu, sejajar dengan grafik di atas dan diwarnai status peringatannya. {canHover ? 'Klik' : 'Ketuk'} satu
                minggu untuk menjadikannya minggu yang dilihat.
              </p>
            </div>
          </>
        ) : (
          <WeekTable
            ds={ds}
            disease={disease}
            regionName={regionName}
            range={range}
            rain={rain}
            cases={cases}
            expected={expected}
            threshold={threshold}
            levels={levels}
            forecast={forecast}
          />
        )}
      </div>
    </Card>
    </div>
  );
}

interface WeekTableProps {
  ds: Dataset;
  disease: DiseaseId;
  regionName: string;
  range: { from: number; to: number };
  rain: number[];
  cases: number[];
  expected: number[];
  threshold: number[];
  levels: AlertLevel[];
  forecast: ForecastPoint[];
}

const TH = 'whitespace-nowrap px-3 py-2.5';
const TD = 'px-3 py-2';

function WeekTable({ ds, disease, regionName, range, rain, cases, expected, threshold, levels, forecast }: WeekTableProps) {
  const d = DISEASES[disease];
  const observed = useMemo(() => {
    const rows = [];
    for (let i = range.to; i >= range.from; i--) {
      rows.push({
        i,
        week: ds.weeks[i],
        rain: rain[i],
        cases: cases[i],
        expected: expected[i],
        threshold: threshold[i],
        above: cases[i] > threshold[i],
        level: levels[i - range.from],
      });
    }
    return rows;
  }, [ds, range.from, range.to, rain, cases, expected, threshold, levels]);
  const projected = useMemo(() => [...forecast].sort((a, b) => b.horizon - a.horizon), [forecast]);

  return (
    <div className="-mx-4 max-h-[520px] overflow-auto border-y border-line sm:-mx-5">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
        <caption className="sr-only">
          Curah hujan dan kasus {d.name} per minggu di {regionName}, dengan rata-rata historis, ambang, dan status peringatan. Minggu terbaru di
          atas, diawali baris proyeksi.
        </caption>
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-2 text-[12px] font-bold text-ink-2 shadow-[inset_0_-1px_0_var(--line)]">
            <th scope="col" className={`${TH} pl-4 sm:pl-5`}>Minggu</th>
            <th scope="col" className={`${TH} text-right`}>Hujan (mm)</th>
            <th scope="col" className={`${TH} text-right`}>Kasus</th>
            <th scope="col" className={`${TH} text-right`}>Rata-rata historis</th>
            <th scope="col" className={`${TH} text-right`}>Ambang</th>
            <th scope="col" className={TH}>Kasus terhadap ambang</th>
            <th scope="col" className={`${TH} pr-4 sm:pr-5`}>Status</th>
          </tr>
        </thead>
        {projected.length > 0 && (
          <tbody>
            <tr className="border-b border-line bg-surface">
              <th scope="colgroup" colSpan={7} className="px-4 pb-1.5 pt-3 text-left sm:px-5">
                <span className="eyebrow">Proyeksi indikatif {projected.length} minggu ke depan</span>
              </th>
            </tr>
            {projected.map((p) => (
              <tr key={`f${p.horizon}`} className="border-b border-line align-top">
                <th scope="row" className={`${TD} whitespace-nowrap pl-4 font-semibold text-ink sm:pl-5`}>
                  <span className="num">
                    {fmtWeekShort(p)} · {isoYearOf(p.date)}
                  </span>
                  <span className="num block font-normal text-muted sm:ml-2 sm:inline">{fmtWeekRange({ date: p.date, endDate: addDays(p.date, 6) })}</span>
                </th>
                <td className={`${TD} text-right text-muted`}>
                  <span aria-hidden>–</span>
                  <span className="sr-only">belum ada</span>
                </td>
                <td className={`${TD} num whitespace-nowrap text-right text-ink`}>
                  <span className="font-semibold">{fmtCases(p.expected)}</span>
                  <span className="block text-[12px] leading-4 text-muted">
                    rentang {fmtCases(p.low)}–{fmtCases(p.high)}
                  </span>
                </td>
                <td className={`${TD} num text-right text-ink-2`}>{fmtCases(p.baseline)}</td>
                <td className={`${TD} num text-right text-ink-2`}>{fmtCases(p.threshold)}</td>
                <td className={`${TD} whitespace-nowrap`}>
                  <ThresholdMark above={p.expected > p.threshold} color={d.color} projected />
                </td>
                <td className={`${TD} pr-4 sm:pr-5`}>
                  <span className="inline-flex h-6 items-center rounded-full border border-line-strong px-2 text-[12px] font-semibold text-ink-2">
                    Proyeksi
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        )}
        <tbody>
          <tr className="border-b border-line bg-surface">
            <th scope="colgroup" colSpan={7} className="px-4 pb-1.5 pt-3 text-left sm:px-5">
              <span className="eyebrow">Data teramati</span>
            </th>
          </tr>
          {observed.map((r) => (
            <tr key={r.i} className="border-b border-line last:border-0 hover:bg-surface-2">
              <th scope="row" className={`${TD} whitespace-nowrap pl-4 font-semibold text-ink sm:pl-5`}>
                <span className="num">
                  {fmtWeekShort(r.week)} · {r.week.isoYear}
                </span>
                <span className="num block font-normal text-muted sm:ml-2 sm:inline">{fmtWeekRange(r.week)}</span>
              </th>
              <td className={`${TD} num text-right text-ink`}>{fmtDec(r.rain, 1)}</td>
              <td className={`${TD} num text-right font-semibold text-ink`}>{fmtInt(r.cases)}</td>
              <td className={`${TD} num text-right text-ink-2`}>{fmtCases(r.expected)}</td>
              <td className={`${TD} num text-right text-ink-2`}>{fmtCases(r.threshold)}</td>
              <td className={`${TD} whitespace-nowrap`}>
                <ThresholdMark above={r.above} color={d.color} />
              </td>
              <td className={`${TD} pr-4 sm:pr-5`}>
                <LevelBadge level={r.level} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Teks "di atas / di bawah ambang"; titik berwarna penyakit meniru penanda pada grafik (bukan satu-satunya isyarat). */
function ThresholdMark({ above, color, projected = false }: { above: boolean; color: string; projected?: boolean }) {
  if (!above) return <span className="text-ink-2">Di bawah ambang</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
      <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {projected ? 'Diproyeksikan di atas ambang' : 'Di atas ambang'}
    </span>
  );
}
