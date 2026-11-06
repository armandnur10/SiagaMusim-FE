'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import { LevelBadge } from '@/components/ui';
import { CITY_NAME } from '@/lib/config';
import { useEws } from '@/lib/data/EwsDataProvider';
import { assessRegionAll, searchKelurahan } from '@/lib/summary';
import { STATUS_PANEL_ID, useLandingSelection } from './selection';

/** Contoh kelurahan untuk tombol cepat; yang tidak ada di dataset dilewati. */
const EXAMPLE_IDS = ['kampung-melayu', 'rawamangun', 'ciracas', 'klender'];
const MAX_EXAMPLES = 4;
const MAX_RESULTS = 8;

/**
 * Pencarian kelurahan (pola combobox + listbox WAI-ARIA).
 * Papan ketik: ↓/↑ pindah pilihan, Enter memilih, Esc menutup daftar lalu membatalkan ketikan.
 */
export function KelurahanSearch() {
  const { dataset: ds } = useEws();
  const { selectedId, select } = useLandingSelection();
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const hintId = `${uid}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);

  // null = tidak sedang mengetik: kolom menampilkan nama kelurahan terpilih (bisa dipilih dari peta).
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selected = selectedId && ds ? ds.regions[selectedId] : undefined;
  const value = draft ?? selected?.name ?? '';
  const query = (draft ?? '').trim();

  const results = useMemo(() => {
    if (!ds || !query) return [];
    return searchKelurahan(ds, query, MAX_RESULTS).map((id) => ({
      id,
      region: ds.regions[id],
      level: assessRegionAll(ds, id).worst.level,
    }));
  }, [ds, query]);

  const examples = useMemo(() => {
    if (!ds) return [];
    const known = EXAMPLE_IDS.filter((id) => ds.regions[id]?.kind === 'kelurahan');
    return (known.length >= 2 ? known : ds.kelurahanIds).slice(0, MAX_EXAMPLES).map((id) => ds.regions[id]);
  }, [ds]);

  const showList = open && query.length > 0;
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));
  const optionId = (i: number) => `${uid}-opt-${i}`;

  useEffect(() => {
    if (showList && results.length > 0) document.getElementById(`${uid}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [showList, results.length, activeIndex, uid]);

  /**
   * Di layar sempit panel hasil berada di bawah kolom cari. Setelah memilih, tutup papan ketik
   * (perangkat sentuh) dan gulir ke panel supaya hasilnya langsung terlihat.
   */
  const revealPanel = () => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) inputRef.current?.blur();
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() =>
      document.getElementById(STATUS_PANEL_ID)?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' }),
    );
  };

  const choose = (id: string) => {
    select(id);
    setDraft(null);
    setOpen(false);
    revealPanel();
  };

  const clear = () => {
    select(null);
    setDraft(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.length === 0) return;
      e.preventDefault();
      if (!showList) {
        setOpen(true);
        return;
      }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIndex + step + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (showList && results[activeIndex]) {
        e.preventDefault();
        choose(results[activeIndex].id);
      }
    } else if (e.key === 'Escape') {
      if (showList) {
        e.preventDefault();
        setOpen(false);
      } else if (draft !== null) {
        setDraft(null);
      }
    }
  };

  return (
    <div>
      <label htmlFor={inputId} className="block text-[15px] font-bold text-ink">
        Cari kelurahan Anda
      </label>
      <div className="relative mt-2">
        <Search size={20} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results.length > 0 ? optionId(activeIndex) : undefined}
          aria-describedby={hintId}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Ketik nama kelurahan"
          value={value}
          onChange={(e) => {
            setDraft(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={(e) => {
            if (draft === null && selected) e.target.select();
            if (query) setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
            setDraft(null);
          }}
          onKeyDown={onKeyDown}
          className="h-14 w-full rounded-xl border border-line-strong bg-surface pl-12 pr-14 text-[16px] font-medium text-ink shadow-card placeholder:font-normal placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
        {value !== '' && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            aria-label="Hapus pilihan kelurahan"
            className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        )}

        <div
          className={clsx(
            'absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-pop',
            !showList && 'hidden',
          )}
        >
          <ul id={listId} role="listbox" aria-label="Hasil pencarian kelurahan" className="max-h-[336px] overflow-y-auto py-1.5">
            {results.map((r, i) => (
              <li
                key={r.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r.id)}
                className={clsx(
                  'mx-1.5 flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2',
                  i === activeIndex && 'bg-brand-soft',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold leading-5 text-ink">Kel. {r.region.name}</span>
                  <span className="block truncate text-[13px] leading-5 text-ink-2">Kec. {r.region.kecamatan}</span>
                </span>
                <LevelBadge level={r.level} size="sm" className="shrink-0" />
              </li>
            ))}
          </ul>
          {results.length === 0 && (
            <p className="px-4 pb-4 pt-2.5 text-[14px] leading-6 text-ink-2">
              {ds
                ? 'Kelurahan tidak ditemukan. Periksa ejaannya, atau coba ketik nama kecamatan.'
                : 'Data sedang dimuat. Tunggu sebentar.'}
            </p>
          )}
        </div>
      </div>

      <p className="sr-only" role="status">
        {showList && ds ? (results.length > 0 ? `${results.length} kelurahan ditemukan.` : 'Kelurahan tidak ditemukan.') : ''}
      </p>

      <p id={hintId} className="mt-2 text-[13px] leading-5 text-muted">
        Mencakup {ds ? ds.kelurahanIds.length : 65} kelurahan di {ds ? ds.kecamatanIds.length : 10} kecamatan {CITY_NAME}.
      </p>

      <p id={`${uid}-examples`} className="mt-5 text-[13px] font-semibold leading-5 text-ink-2">
        Atau pilih salah satu contoh
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-labelledby={`${uid}-examples`}>
        {ds
          ? examples.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === selectedId}
                onClick={() => choose(r.id)}
                className={clsx(
                  'inline-flex min-h-[44px] items-center rounded-full border px-4 text-[14px] font-semibold transition-colors',
                  r.id === selectedId
                    ? 'border-brand bg-brand-soft text-brand-strong'
                    : 'border-line-strong bg-surface text-ink hover:border-brand hover:text-brand',
                )}
              >
                {r.name}
              </button>
            ))
          : Array.from({ length: MAX_EXAMPLES }, (_, i) => <span key={i} aria-hidden className="skeleton h-11 w-28 !rounded-full" />)}
      </div>
    </div>
  );
}
