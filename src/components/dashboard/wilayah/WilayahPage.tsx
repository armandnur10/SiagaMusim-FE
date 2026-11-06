'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown, Search, SearchX, TriangleAlert, X } from 'lucide-react';
import { Sparkline } from '@/components/charts';
import { PageHeader } from '@/components/shell';
import { Card, DataGate, LevelBadge, LevelDot } from '@/components/ui';
import { CITY_ID, CITY_NAME, DISEASES, FORECAST_HORIZON, LEVELS, LEVEL_ORDER, rainIntensityLabel } from '@/lib/config';
import { useDataset } from '@/lib/data/EwsDataProvider';
import { forecast } from '@/lib/engines/forecast';
import { assessMany, countByLevel } from '@/lib/engines/risk';
import { fmtDec, fmtInt, fmtRain, fmtWeekLong, fmtWeekRange } from '@/lib/format';
import { useFilters } from '@/lib/state/filters';
import { rankAssessments } from '@/lib/summary';
import type { AlertLevel, Assessment, Forecast, RegionInfo } from '@/types/ews';
import { ForecastTrend, fmtCases, isAboveThreshold, regionHref } from './shared';

type Tingkat = 'kelurahan' | 'kecamatan';
type SortKey = 'urgensi' | 'nama' | 'skor' | 'kasus' | 'insidensi' | 'hujan' | 'proyeksi';
interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}

const DEFAULT_SORT: Sort = { key: 'urgensi', dir: 'desc' };
const SPARK_WEEKS = 12;
/** Urutan chip: paling berat dulu. */
const LEVEL_CHIPS: AlertLevel[] = [...LEVEL_ORDER].reverse();

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'urgensi:desc', label: 'Paling perlu perhatian' },
  { value: 'kasus:desc', label: 'Kasus terbanyak' },
  { value: 'insidensi:desc', label: 'Insidensi tertinggi' },
  { value: 'skor:desc', label: 'Skor tertinggi' },
  { value: 'hujan:desc', label: 'Hujan tertinggi' },
  { value: 'proyeksi:desc', label: 'Proyeksi paling mengkhawatirkan' },
  { value: 'nama:asc', label: 'Nama A–Z' },
];

interface Row {
  id: string;
  region: RegionInfo;
  a: Assessment;
  f: Forecast;
  spark: number[];
  /** Posisi pada urutan urgensi (0 = paling perlu perhatian). */
  urgency: number;
  /** Nilai urut proyeksi: makin besar makin mengkhawatirkan. */
  outlook: number;
}

const DIRECTION_RANK: Record<Forecast['direction'], number> = { turun: 0, stabil: 1, naik: 2 };

function compareRows(a: Row, b: Row, sort: Sort): number {
  let d = 0;
  switch (sort.key) {
    case 'urgensi':
      d = b.urgency - a.urgency; // "desc" = paling perlu perhatian di atas
      break;
    case 'nama':
      d = a.region.name.localeCompare(b.region.name, 'id');
      break;
    case 'skor':
      d = a.a.score - b.a.score;
      break;
    case 'kasus':
      d = a.a.cases - b.a.cases;
      break;
    case 'insidensi':
      d = a.a.incidenceRate - b.a.incidenceRate;
      break;
    case 'hujan':
      d = a.a.rainThisWeek - b.a.rainThisWeek;
      break;
    case 'proyeksi':
      d = a.outlook - b.outlook;
      break;
  }
  if (sort.dir === 'desc') d = -d;
  return d || a.urgency - b.urgency;
}

// ---------------------------------------------------------------------------
// Kepala kolom yang bisa diurutkan
// ---------------------------------------------------------------------------
interface SortThProps {
  label: string;
  /** Baris kedua yang lebih kecil (satuan/periode). */
  sub?: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}

function SortTh({ label, sub, sortKey, sort, onSort, align = 'left', className }: SortThProps) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={clsx('border-b border-line bg-surface-2 px-3 py-1 align-bottom', align === 'right' ? 'text-right' : 'text-left', className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Urutkan menurut ${label.toLowerCase()}`}
        className={clsx(
          'group/sort inline-flex min-h-[40px] items-center gap-1 whitespace-nowrap rounded-md text-[12px] font-bold leading-4 hover:text-ink',
          align === 'right' ? 'flex-row-reverse text-right' : 'text-left',
          active ? 'text-ink' : 'text-ink-2',
        )}
      >
        <span>
          {label}
          {sub && <span className="block font-medium text-muted">{sub}</span>}
        </span>
        <Icon size={14} strokeWidth={2.25} aria-hidden className={clsx('shrink-0', active ? 'text-ink' : 'text-muted opacity-60 group-hover/sort:opacity-100')} />
      </button>
    </th>
  );
}

function PlainTh({ label, sub, className }: { label: string; sub?: string; className?: string }) {
  return (
    <th scope="col" className={clsx('border-b border-line bg-surface-2 px-3 py-2.5 whitespace-nowrap text-left align-bottom text-[12px] font-bold leading-4 text-ink-2', className)}>
      {label}
      {sub && <span className="block font-medium text-muted">{sub}</span>}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Sel kasus vs ambang (dipakai tabel & kartu ponsel)
// ---------------------------------------------------------------------------
function CasesVsThreshold({ a, align = 'right' }: { a: Assessment; align?: 'left' | 'right' }) {
  const above = isAboveThreshold(a);
  return (
    <>
      <span className={clsx('num inline-flex items-center gap-1 text-[14px] text-ink', above ? 'font-extrabold' : 'font-semibold', align === 'right' && 'justify-end')}>
        {above && <TriangleAlert size={13} strokeWidth={2.5} className="shrink-0" style={{ color: LEVELS.siaga.colorText }} aria-hidden />}
        {fmtInt(a.cases)}
      </span>
      <span className={clsx('num block whitespace-nowrap text-[12px] leading-4', above ? 'font-semibold text-ink-2' : 'text-muted')}>
        {above ? 'di atas ambang' : 'ambang'} {fmtCases(a.threshold)}
      </span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Isi halaman
// ---------------------------------------------------------------------------
function WilayahContent() {
  const ds = useDataset();
  const router = useRouter();
  const { disease, weekIndex, week } = useFilters();
  const d = DISEASES[disease];

  const [tingkat, setTingkat] = useState<Tingkat>('kelurahan');
  const [query, setQuery] = useState('');
  const [kecId, setKecId] = useState('semua');
  const [levels, setLevels] = useState<ReadonlySet<AlertLevel>>(new Set());
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);

  const rows = useMemo<Row[]>(() => {
    const ids = tingkat === 'kelurahan' ? ds.kelurahanIds : ds.kecamatanIds;
    const ranked = rankAssessments(assessMany(ds, ids, disease, weekIndex));
    const from = Math.max(0, weekIndex - SPARK_WEEKS + 1);
    return ranked.map((a, urgency) => {
      const f = forecast(ds, a.regionId, disease, weekIndex);
      return {
        id: a.regionId,
        region: ds.regions[a.regionId],
        a,
        f,
        spark: ds.series[a.regionId].cases[disease].slice(from, weekIndex + 1),
        urgency,
        outlook: f.exceedsAtHorizon !== null ? 10 + (FORECAST_HORIZON - f.exceedsAtHorizon) : DIRECTION_RANK[f.direction],
      };
    });
  }, [ds, tingkat, disease, weekIndex]);

  // Cocok dengan pencarian + kecamatan (sebelum saringan level) -> dasar hitungan chip.
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tingkat === 'kelurahan' && kecId !== 'semua' && r.region.kecamatanId !== kecId) return false;
      if (!q) return true;
      return r.region.name.toLowerCase().includes(q) || (r.region.kecamatan ?? '').toLowerCase().includes(q);
    });
  }, [rows, query, kecId, tingkat]);

  const counts = useMemo(() => countByLevel(matched.map((r) => r.a)), [matched]);

  const visible = useMemo(() => {
    const list = levels.size === 0 ? [...matched] : matched.filter((r) => levels.has(r.a.level));
    return list.sort((a, b) => compareRows(a, b, sort));
  }, [matched, levels, sort]);

  const unit = tingkat === 'kelurahan' ? 'kelurahan' : 'kecamatan';
  const hasFilter = query.trim() !== '' || levels.size > 0 || (tingkat === 'kelurahan' && kecId !== 'semua');

  const resetFilters = () => {
    setQuery('');
    setKecId('semua');
    setLevels(new Set());
  };
  const toggleLevel = (lv: AlertLevel) =>
    setLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lv)) next.delete(lv);
      else next.add(lv);
      return next;
    });
  const onSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'nama' ? 'asc' : 'desc' }));

  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, id: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('a, button')) return;
    if (window.getSelection()?.toString()) return;
    router.push(regionHref(id));
  };

  const sortValue = `${sort.key}:${sort.dir}`;
  const sortOptions = SORT_OPTIONS.some((o) => o.value === sortValue)
    ? SORT_OPTIONS
    : [...SORT_OPTIONS, { value: sortValue, label: 'Urutan dari kepala tabel' }];

  const sub = (r: Row): string => (r.region.kind === 'kelurahan' ? `Kec. ${r.region.kecamatan ?? ''}` : `${fmtInt(r.region.childIds.length)} kelurahan`);

  return (
    <Card flush>
      {/* Kontrol */}
      <div className="grid grid-cols-1 gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <div className="segmented" role="group" aria-label="Tingkat wilayah">
            <button type="button" aria-pressed={tingkat === 'kelurahan'} onClick={() => setTingkat('kelurahan')}>
              Kelurahan <span className="num font-medium text-muted">{fmtInt(ds.kelurahanIds.length)}</span>
            </button>
            <button type="button" aria-pressed={tingkat === 'kecamatan'} onClick={() => setTingkat('kecamatan')}>
              Kecamatan <span className="num font-medium text-muted">{fmtInt(ds.kecamatanIds.length)}</span>
            </button>
          </div>

          <div className="relative min-w-0 flex-1 basis-[220px] sm:max-w-[300px]">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              className="field w-full pl-9 pr-10 placeholder:text-muted"
              placeholder={tingkat === 'kelurahan' ? 'Cari kelurahan atau kecamatan' : 'Cari kecamatan'}
              aria-label={tingkat === 'kelurahan' ? 'Cari nama kelurahan atau kecamatan' : 'Cari nama kecamatan'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Hapus pencarian"
                className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-[10px] text-muted hover:text-ink"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>

          {tingkat === 'kelurahan' && (
            <select
              className="field min-w-0 max-w-full"
              aria-label="Saring menurut kecamatan"
              value={kecId}
              onChange={(e) => setKecId(e.target.value)}
            >
              <option value="semua">Semua kecamatan</option>
              {ds.kecamatanIds.map((id) => (
                <option key={id} value={id}>
                  Kec. {ds.regions[id].name}
                </option>
              ))}
            </select>
          )}

          <label className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink-2 md:hidden">
            <span className="shrink-0">Urutkan</span>
            <select
              className="field min-w-0 max-w-full"
              value={sortValue}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':') as [SortKey, Sort['dir']];
                setSort({ key, dir });
              }}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saring menurut level peringatan">
          <button
            type="button"
            aria-pressed={levels.size === 0}
            onClick={() => setLevels(new Set())}
            className={clsx(
              'inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
              levels.size === 0 ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
            )}
          >
            Semua <span className="num font-medium opacity-80">{fmtInt(matched.length)}</span>
          </button>
          {LEVEL_CHIPS.map((lv) => {
            const on = levels.has(lv);
            return (
              <button
                key={lv}
                type="button"
                aria-pressed={on}
                onClick={() => toggleLevel(lv)}
                className={clsx(
                  'inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors',
                  on ? 'border-ink bg-surface text-ink shadow-[inset_0_0_0_1px_var(--ink)]' : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
                  !on && counts[lv] === 0 && 'opacity-60',
                )}
              >
                <LevelDot level={lv} />
                {LEVELS[lv].label}
                <span className="num font-medium text-muted">{fmtInt(counts[lv])}</span>
              </button>
            );
          })}
        </div>

        <p className="text-[13px] leading-5 text-ink-2" aria-live="polite">
          Menampilkan <strong className="num font-semibold text-ink">{fmtInt(visible.length)}</strong> dari{' '}
          <span className="num">{fmtInt(rows.length)}</span> {unit}
          <span className="text-muted">
            {' '}
            · {d.short}
            {week ? ` · ${fmtWeekLong(week)} (${fmtWeekRange(week)})` : ''}
          </span>
          {hasFilter && (
            <>
              {' · '}
              <button type="button" onClick={resetFilters} className="rounded font-semibold text-brand underline underline-offset-2 hover:text-brand-strong">
                Hapus filter
              </button>
            </>
          )}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="border-t border-line px-4 py-12 text-center sm:px-5">
          <SearchX className="mx-auto mb-3 text-muted" size={28} aria-hidden />
          <h2 className="text-[16px] font-bold text-ink">Tidak ada {unit} yang cocok</h2>
          <p className="mx-auto mt-1 max-w-md text-[14px] leading-6 text-ink-2">
            Tidak ada {unit} yang sesuai dengan pencarian dan filter saat ini untuk {d.short} pada minggu yang dipilih.
          </p>
          <button type="button" className="btn btn-primary mt-4" onClick={resetFilters}>
            Hapus semua filter
          </button>
        </div>
      ) : (
        <>
          {/* Tabel (≥ md) */}
          <div className="hidden max-h-[max(440px,calc(100vh-330px))] overflow-auto rounded-b-card border-t border-line md:block">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-[13px]">
              <caption className="sr-only">
                Daftar {unit} untuk {d.name}
                {week ? `, ${fmtWeekLong(week)}` : ''}. Klik kepala kolom untuk mengurutkan.
              </caption>
              <thead className="sticky top-0 z-10">
                <tr>
                  <SortTh label="Wilayah" sortKey="nama" sort={sort} onSort={onSort} className="sticky left-0 z-10 pl-4 max-xl:shadow-[1px_0_0_var(--line)] sm:pl-5" />
                  <SortTh label="Level" sortKey="urgensi" sort={sort} onSort={onSort} />
                  <SortTh label="Skor" sub="0–100" sortKey="skor" sort={sort} onSort={onSort} align="right" />
                  <SortTh label="Kasus" sub="minggu ini" sortKey="kasus" sort={sort} onSort={onSort} align="right" />
                  <SortTh label="Insidensi" sub="per 100 rb" sortKey="insidensi" sort={sort} onSort={onSort} align="right" />
                  <SortTh label="Hujan" sub="minggu ini" sortKey="hujan" sort={sort} onSort={onSort} align="right" />
                  <PlainTh label="Tren kasus" sub={`${SPARK_WEEKS} minggu`} className="pl-5" />
                  <SortTh label="Proyeksi" sub={`${FORECAST_HORIZON} minggu`} sortKey="proyeksi" sort={sort} onSort={onSort} />
                  <th scope="col" className="border-b border-line bg-surface-2 pr-3">
                    <span className="sr-only">Buka profil</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} onClick={(e) => onRowClick(e, r.id)} className="group cursor-pointer hover:bg-surface-2 [&:last-child>*]:border-b-0">
                    <th scope="row" className="sticky left-0 whitespace-nowrap border-b border-line bg-surface py-2.5 pl-4 pr-3 text-left font-normal group-hover:bg-surface-2 max-xl:shadow-[1px_0_0_var(--line)] sm:pl-5">
                      <Link href={regionHref(r.id)} className="text-[14px] font-bold text-ink underline-offset-2 group-hover:underline">
                        {r.region.name}
                      </Link>
                      <span className="block text-[12px] leading-4 text-muted">{sub(r)}</span>
                    </th>
                    <td className="border-b border-line px-3 py-2.5">
                      <LevelBadge level={r.a.level} size="sm" />
                    </td>
                    <td className="num border-b border-line px-3 py-2.5 text-right text-[14px] font-semibold text-ink">{fmtInt(r.a.score)}</td>
                    <td className="border-b border-line px-3 py-2.5 text-right">
                      <CasesVsThreshold a={r.a} />
                    </td>
                    <td className="num border-b border-line px-3 py-2.5 text-right text-[14px] text-ink">{fmtDec(r.a.incidenceRate, 1)}</td>
                    <td className="whitespace-nowrap border-b border-line px-3 py-2.5 text-right">
                      <span className="num block text-[14px] text-ink">{fmtRain(r.a.rainThisWeek)}</span>
                      <span className="block text-[12px] leading-4 text-muted">{rainIntensityLabel(r.a.rainThisWeek)}</span>
                    </td>
                    <td className="border-b border-line py-2.5 pl-5 pr-3">
                      <Sparkline
                        values={r.spark}
                        color={d.color}
                        ariaLabel={`Tren kasus ${d.short} ${r.spark.length} minggu di ${r.region.name}: dari ${fmtInt(r.spark[0] ?? 0)} menjadi ${fmtInt(r.a.cases)}`}
                      />
                    </td>
                    <td className="whitespace-nowrap border-b border-line px-3 py-2.5">
                      <ForecastTrend assessment={r.a} forecast={r.f} />
                    </td>
                    <td className="border-b border-line pr-3 text-right">
                      <Link
                        href={regionHref(r.id)}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="inline-flex h-10 w-8 items-center justify-center text-muted group-hover:text-ink"
                      >
                        <ChevronRight size={18} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Daftar kartu ringkas (< md) */}
          <ul className="border-t border-line md:hidden">
            {visible.map((r) => (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <Link href={regionHref(r.id)} className="block px-4 py-3.5 active:bg-surface-2">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold leading-5 text-ink">{r.region.name}</span>
                      <span className="block text-[12px] leading-4 text-muted">{sub(r)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <LevelBadge level={r.a.level} size="sm" />
                      <ChevronRight size={16} className="text-muted" aria-hidden />
                    </span>
                  </span>
                  <span className="mt-2.5 flex items-end justify-between gap-3">
                    <span className="flex min-w-0 gap-4">
                      <span className="block w-[122px] shrink-0">
                        <span className="block text-[11px] font-semibold leading-4 text-muted">Kasus</span>
                        <CasesVsThreshold a={r.a} align="left" />
                      </span>
                      <span className="block">
                        <span className="block text-[11px] font-semibold leading-4 text-muted">Insidensi</span>
                        <span className="num block text-[14px] font-semibold text-ink">{fmtDec(r.a.incidenceRate, 1)}</span>
                        <span className="block text-[12px] leading-4 text-muted">per 100 rb</span>
                      </span>
                    </span>
                    <Sparkline
                      values={r.spark}
                      color={d.color}
                      width={84}
                      height={30}
                      ariaLabel={`Tren kasus ${r.spark.length} minggu: dari ${fmtInt(r.spark[0] ?? 0)} menjadi ${fmtInt(r.a.cases)}`}
                    />
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[12px] leading-4 text-muted">
                    Proyeksi:
                    <ForecastTrend assessment={r.a} forecast={r.f} inline />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function WilayahPage() {
  return (
    <>
      <PageHeader
        title="Wilayah"
        description="Bandingkan semua kelurahan atau kecamatan untuk penyakit dan minggu yang dipilih. Urutan awal menempatkan wilayah yang paling perlu perhatian di atas."
        actions={
          <Link className="btn btn-ghost" href={regionHref(CITY_ID)}>
            Profil {CITY_NAME}
            <ChevronRight size={16} aria-hidden />
          </Link>
        }
      />
      <DataGate>
        <WilayahContent />
      </DataGate>
    </>
  );
}
