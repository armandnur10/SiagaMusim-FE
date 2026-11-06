'use client';

import { useId } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Dataset } from '@/types/ews';
import { RANGE_OPTIONS, regionHref, regionTitle, type RangeId } from './helpers';

interface TrenFiltersProps {
  ds: Dataset;
  regionId: string;
  onRegionChange: (id: string) => void;
  range: RangeId;
  onRangeChange: (id: RangeId) => void;
}

/** Satu baris filter di atas semua grafik: wilayah, rentang waktu, dan tautan ke profil wilayah. */
export function TrenFilters({ ds, regionId, onRegionChange, range, onRangeChange }: TrenFiltersProps) {
  const selectId = useId();
  const rangeLabelId = useId();
  const region = ds.regions[regionId];

  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <div className="grid w-full gap-1.5 sm:w-auto">
        <label htmlFor={selectId} className="text-[12px] font-semibold leading-4 text-ink-2">
          Wilayah
        </label>
        <select
          id={selectId}
          className="field w-full sm:w-[280px]"
          value={regionId}
          onChange={(e) => onRegionChange(e.target.value)}
        >
          <optgroup label="Kota">
            <option value={ds.cityId}>{ds.regions[ds.cityId].name}</option>
          </optgroup>
          <optgroup label="Kecamatan">
            {ds.kecamatanIds.map((id) => (
              <option key={id} value={id}>
                {regionTitle(ds.regions[id])}
              </option>
            ))}
          </optgroup>
          {ds.kecamatanIds.map((kecId) => (
            <optgroup key={kecId} label={`Kelurahan di Kec. ${ds.regions[kecId].name}`}>
              {ds.regions[kecId].childIds.map((id) => (
                <option key={id} value={id}>
                  {ds.regions[id].name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid w-full gap-1.5 sm:w-auto">
        <span id={rangeLabelId} className="text-[12px] font-semibold leading-4 text-ink-2">
          Rentang
        </span>
        <div className="segmented w-full sm:w-auto" role="group" aria-labelledby={rangeLabelId}>
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={range === o.id}
              aria-label={o.weeks === null ? 'Semua minggu dalam data' : `${o.weeks} minggu terakhir`}
              className="!min-h-10 flex-1 justify-center !px-2 sm:!min-h-[34px] sm:flex-none sm:!px-3"
              onClick={() => onRangeChange(o.id)}
            >
              <span className="sm:hidden">{o.short}</span>
              <span className="hidden sm:inline">{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Link href={regionHref(regionId)} className="btn btn-ghost w-full sm:ml-auto sm:w-auto">
        Profil {regionTitle(region)}
        <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  );
}
