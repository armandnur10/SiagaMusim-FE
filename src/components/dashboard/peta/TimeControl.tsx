'use client';

import clsx from 'clsx';
import { ChevronLeft, ChevronRight, History, Pause, Play } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CITY_NAME, DISEASES } from '@/lib/config';
import { useDataset } from '@/lib/data/EwsDataProvider';
import { fmtInt, fmtWeekLong, fmtWeekRange } from '@/lib/format';
import { useFilters } from '@/lib/state/filters';
import type { Dataset, DiseaseId } from '@/types/ews';

/** Jeda antarminggu saat diputar. */
const TICK_MS = 500;
/** Menekan "Putar ulang" di minggu terbaru memutar ulang sekian minggu terakhir. */
const REPLAY_WEEKS = 52;
/** Dengan preferensi "kurangi gerakan", satu kali putar hanya maju sekian minggu lalu berhenti. */
const REDUCED_MOTION_WEEKS = 12;
/** Lebar gagang penggeser (px). Area grafik dijorokkan setengahnya agar gagang sejajar dengan data. */
const THUMB = 18;
const STRIP_H = 36;

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const subscribeReduced = (onChange: () => void): (() => void) => {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};
const usePrefersReducedMotion = (): boolean =>
  useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );

interface StripModel {
  /** Lebar viewBox = jumlah minggu - 1 (satu satuan = satu minggu). */
  span: number;
  line: string;
  area: string;
  /** Awal tiap tahun pada deret: posisi 0..1 dan labelnya. */
  years: { year: number; frac: number }[];
}

/** Bentuk deret kasus tingkat kota untuk strip konteks (koordinat viewBox: x = indeks minggu, y = 0..100). */
function buildStrip(ds: Dataset, disease: DiseaseId): StripModel {
  const values = ds.series[ds.cityId].cases[disease];
  const n = ds.latestWeek + 1;
  const span = Math.max(1, n - 1);
  let max = 0;
  for (let i = 0; i < n; i++) if (values[i] > max) max = values[i];
  // Sisakan 10% ruang kepala agar puncak tidak menyentuh tepi atas.
  const y = (v: number): string => (max > 0 ? 100 - (v / max) * 90 : 100).toFixed(2);
  let line = '';
  for (let i = 0; i < n; i++) line += `${i === 0 ? 'M' : 'L'}${i},${y(values[i])}`;
  if (n === 1) line += `L${span},${y(values[0])}`;
  const area = `${line}L${span},100L0,100Z`;

  const years: StripModel['years'] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0 || ds.weeks[i].isoYear !== ds.weeks[i - 1].isoYear) years.push({ year: ds.weeks[i].isoYear, frac: i / span });
  }
  return { span, line, area, years };
}

/**
 * Pemutar waktu peta: strip konteks (kasus tingkat kota sepanjang data) dengan penggeser
 * minggu di atasnya, tombol putar/jeda, dan tombol langkah. Membaca & menulis `weekIndex`
 * global yang sama dengan penggeser minggu di bilah atas.
 */
export function TimeControl({ className }: { className?: string }) {
  const ds = useDataset();
  const { disease, weekIndex, isLatest, setWeekIndex, stepWeek, resetWeek } = useFilters();
  const reducedMotion = usePrefersReducedMotion();
  const clipId = `tc-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const latest = ds.latestWeek;
  const week = ds.weeks[weekIndex];
  const d = DISEASES[disease];
  const strip = useMemo(() => buildStrip(ds, disease), [ds, disease]);
  const cityCases = ds.series[ds.cityId].cases[disease][weekIndex];

  // --- Putar / jeda ---
  const [playing, setPlaying] = useState(false);
  const weekRef = useRef(weekIndex);
  /** Sisa minggu yang boleh diputar pada sesi putar ini. */
  const budgetRef = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    weekRef.current = weekIndex;
  }, [weekIndex]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = weekRef.current + 1;
      if (next > latest || budgetRef.current <= 0) {
        setPlaying(false);
        return;
      }
      budgetRef.current -= 1;
      weekRef.current = next;
      setWeekIndex(next);
      if (next >= latest || budgetRef.current <= 0) setPlaying(false);
    }, TICK_MS);
    // Berhenti bersih saat dijeda, komponen dilepas, atau pindah halaman.
    return () => window.clearInterval(id);
  }, [playing, latest, setWeekIndex]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    budgetRef.current = reducedMotion ? REDUCED_MOTION_WEEKS : Number.POSITIVE_INFINITY;
    if (weekRef.current >= latest) {
      const start = Math.max(0, latest - (reducedMotion ? REDUCED_MOTION_WEEKS : REPLAY_WEEKS));
      weekRef.current = start;
      setWeekIndex(start);
    }
    setPlaying(true);
  };

  const playText = playing ? 'Jeda' : isLatest ? 'Putar ulang' : 'Putar';
  const playHint = playing
    ? 'Jeda pemutaran'
    : reducedMotion
      ? isLatest
        ? `Putar ulang ${REDUCED_MOTION_WEEKS} minggu terakhir`
        : `Putar ${REDUCED_MOTION_WEEKS} minggu berikutnya`
      : isLatest
        ? `Putar ulang ${REPLAY_WEEKS} minggu terakhir`
        : 'Putar dari minggu ini sampai minggu terbaru';

  const frac = latest > 0 ? weekIndex / latest : 1;
  const markerLeft = `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${frac.toFixed(5)})`;
  const weeksAgo = latest - weekIndex;

  return (
    <div className={clsx('px-4 pb-3.5 pt-2.5 sm:px-5', className)} role="group" aria-label="Pemutar waktu">
      <div className="flex items-baseline justify-between gap-3 text-[11px] leading-4 text-muted" style={{ paddingInline: THUMB / 2 }}>
        <p className="min-w-0 truncate">
          Kasus {d.short} {CITY_NAME} per minggu
        </p>
        <p className="num shrink-0">
          <span className="font-bold text-ink">{fmtInt(cityCases)}</span> kasus
        </p>
      </div>

      {/* Penggeser: <input type="range"> asli (transparan) menumpang di atas strip konteks. */}
      <div className="relative mt-0.5">
        <input
          type="range"
          className="peer absolute inset-x-0 top-0 z-10 m-0 w-full cursor-pointer appearance-none bg-transparent opacity-0 [&::-moz-range-thumb]:h-full [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:h-full [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none"
          style={{ height: STRIP_H + 8 }}
          min={0}
          max={latest}
          step={1}
          value={weekIndex}
          onChange={(e) => {
            setPlaying(false);
            setWeekIndex(Number(e.target.value));
          }}
          aria-label="Minggu yang ditampilkan"
          aria-valuetext={`${fmtWeekLong(week)}, ${fmtWeekRange(week)}`}
        />

        <div
          className="relative rounded-[3px] border-b border-line-strong outline-2 outline-offset-4 outline-[var(--focus-ring)] peer-focus-visible:outline"
          style={{ marginInline: THUMB / 2, height: STRIP_H }}
        >
          {strip.years.map((y) =>
            y.frac > 0 ? (
              <span key={y.year} aria-hidden className="absolute inset-y-0 w-px bg-line" style={{ left: `${y.frac * 100}%` }} />
            ) : null,
          )}
          <svg
            aria-hidden
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${strip.span} 100`}
            preserveAspectRatio="none"
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={0} width={weekIndex} height={100} />
              </clipPath>
            </defs>
            <path d={strip.area} fill={d.color} opacity={0.14} />
            <path d={strip.area} fill={d.color} opacity={0.3} clipPath={`url(#${clipId})`} />
            <path d={strip.line} fill="none" stroke={d.color} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>

        {/* Penanda minggu terpilih: garis + gagang; mengikuti nilai penggeser. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 w-0.5 -translate-x-1/2 rounded-full bg-ink"
          style={{ left: markerLeft, height: STRIP_H }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink peer-focus-visible:shadow-[0_0_0_2px_var(--focus-ring)]"
          style={{ left: markerLeft, top: STRIP_H }}
        />

        <div aria-hidden className="num relative h-[18px] text-[10.5px] font-medium leading-[14px] text-muted" style={{ marginInline: THUMB / 2 }}>
          {strip.years.map((y) =>
            y.frac < 0.93 ? (
              <span key={y.year} className="absolute top-1" style={{ left: `calc(${y.frac * 100}% + ${y.frac > 0 ? 4 : 0}px)` }}>
                {y.year}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="order-first w-full min-w-0 leading-tight sm:order-none sm:w-auto sm:flex-1 lg:order-first lg:w-full lg:flex-none xl:order-none xl:w-auto xl:flex-1">
          <p className="num text-[14px] font-bold leading-5 text-ink">{fmtWeekLong(week)}</p>
          <p className="num text-[12px] leading-4 text-muted">
            {fmtWeekRange(week)} · {isLatest ? 'minggu terbaru' : `${fmtInt(weeksAgo)} minggu sebelum terbaru`}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary order-first px-3.5 sm:min-w-[128px] lg:min-w-0 xl:min-w-[128px]"
          onClick={togglePlay}
          aria-label={playHint}
          title={playHint}
        >
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {playText}
        </button>

        <div className="order-first flex h-10 items-center rounded-[10px] border border-line-strong bg-surface">
          <button
            type="button"
            className="flex h-full w-10 items-center justify-center rounded-l-[9px] text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-35"
            onClick={() => {
              setPlaying(false);
              stepWeek(-1);
            }}
            disabled={weekIndex <= 0}
            aria-label="Mundur satu minggu"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span aria-hidden className="h-5 w-px bg-line" />
          <button
            type="button"
            className="flex h-full w-10 items-center justify-center rounded-r-[9px] text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-35"
            onClick={() => {
              setPlaying(false);
              stepWeek(1);
            }}
            disabled={isLatest}
            aria-label="Maju satu minggu"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        {!isLatest && (
          <button
            type="button"
            className="btn btn-ghost ml-auto px-3 text-[13px]"
            aria-label="Kembali ke minggu terbaru"
            onClick={() => {
              setPlaying(false);
              resetWeek();
            }}
          >
            <History size={15} aria-hidden />
            <span className="sm:hidden lg:inline xl:hidden">Terbaru</span>
            <span className="hidden sm:inline lg:hidden xl:inline">Minggu terbaru</span>
          </button>
        )}
      </div>
    </div>
  );
}
