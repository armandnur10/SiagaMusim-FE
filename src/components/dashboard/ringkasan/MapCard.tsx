'use client';

import Link from 'next/link';
import { ArrowRight, MousePointerClick, X } from 'lucide-react';
import { RiskMap } from '@/components/map';
import { Card, LevelBadge } from '@/components/ui';
import { DISEASES } from '@/lib/config';
import { assess } from '@/lib/engines/risk';
import { fmtInt } from '@/lib/format';
import type { Dataset, DiseaseId } from '@/types/ews';
import { fmtThreshold, regionHref } from './helpers';
import { MORE_LINK, SectionHeader } from './SectionHeader';
import { useIsDesktop } from './useIsDesktop';

interface MapCardProps {
  ds: Dataset;
  disease: DiseaseId;
  weekIndex: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

/** Bagian B (kiri): peta level peringatan 65 kelurahan + rincian singkat kelurahan terpilih. */
export function MapCard({ ds, disease, weekIndex, selectedId, onSelect, className }: MapCardProps) {
  const isDesktop = useIsDesktop();
  const d = DISEASES[disease];
  const region = selectedId ? ds.regions[selectedId] : undefined;
  const a = region ? assess(ds, region.id, disease, weekIndex) : null;

  return (
    <Card flush className={className} aria-label={`Peta risiko ${d.short}`}>
      <div className="flex h-full flex-col">
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <SectionHeader
            title={`Peta risiko ${d.short}`}
            subtitle={
              isDesktop
                ? 'Level peringatan tiap kelurahan. Klik satu kelurahan untuk melihat rinciannya.'
                : 'Level peringatan tiap kelurahan. Ketuk satu kelurahan untuk melihat rinciannya.'
            }
            action={
              <Link href="/dashboard/peta" className={MORE_LINK}>
                Buka peta lengkap
                <ArrowRight size={15} aria-hidden />
              </Link>
            }
          />
        </div>

        {/* Induk berposisi dengan tinggi eksplisit; peta mengisi 100% lewat pembungkus absolut. */}
        <div className="relative h-[360px] border-y border-line md:h-[440px] xl:h-auto xl:min-h-[480px] xl:flex-1">
          <div className="absolute inset-0">
            <RiskMap
              dataset={ds}
              disease={disease}
              weekIndex={weekIndex}
              metric="level"
              selectedId={selectedId}
              onSelect={onSelect}
              interactive={isDesktop}
            />
          </div>
        </div>

        <div aria-live="polite" className="flex min-h-[68px] items-center px-4 py-3 sm:px-5">
          {region && a ? (
            <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-[14px] font-bold leading-5 text-ink">{region.name}</p>
                <p className="text-[12px] leading-4 text-muted">Kec. {region.kecamatan}</p>
              </div>
              <LevelBadge level={a.level} size="sm" />
              <p className="text-[13px] leading-5 text-ink">
                kasus <strong className="font-bold">{fmtInt(a.cases)}</strong> · ambang {fmtThreshold(a.threshold)}
              </p>
              <p className="min-w-[12rem] flex-1 text-[13px] leading-5 text-ink-2">{a.drivers[0]}</p>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <Link
                  href={regionHref(region.id)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-1 text-[13px] font-semibold text-brand hover:text-brand-strong hover:underline"
                >
                  Profil<span className="sr-only"> {region.name}</span>
                  <ArrowRight size={15} aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={() => onSelect(null)}
                  aria-label="Batalkan pilihan kelurahan"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-[13px] leading-5 text-muted">
              <MousePointerClick size={16} className="shrink-0" aria-hidden />
              Pilih kelurahan pada peta atau daftar prioritas untuk melihat kasus, ambang, dan pemicunya.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
