'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DataGate, DiseaseTag, LevelBadge, ScoreScale } from '@/components/ui';
import { DISEASES, DISEASE_IDS, LEVELS, SCORE_WEIGHTS } from '@/lib/config';
import { useDataset } from '@/lib/data/EwsDataProvider';
import { assessMany } from '@/lib/engines/risk';
import { fmtDec, fmtInt, fmtRain, fmtWeekLong, fmtWeekRange } from '@/lib/format';
import { rankAssessments } from '@/lib/summary';

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-[14px] leading-5 text-ink-2">
        {label}
        {note && <span className="block text-[12px] text-muted">{note}</span>}
      </dt>
      <dd className="num shrink-0 text-right text-[14px] font-bold text-ink">{value}</dd>
    </div>
  );
}

function Example() {
  const ds = useDataset();
  // Ambil contoh paling "berbicara": kelurahan berskor tertinggi minggu terakhir, dari semua penyakit.
  const a = useMemo(() => {
    const all = DISEASE_IDS.flatMap((d) => assessMany(ds, ds.kelurahanIds, d));
    return rankAssessments(all.filter((x) => x.cases >= 4))[0] ?? rankAssessments(all)[0];
  }, [ds]);
  const region = ds.regions[a.regionId];
  const week = ds.weeks[a.weekIndex];
  const d = DISEASES[a.disease];
  const w = SCORE_WEIGHTS;
  const ratio = a.rainExposureNormal > 0 ? a.rainExposure / a.rainExposureNormal : 1;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3.5 sm:px-5">
        <div>
          <p className="text-[16px] font-bold text-ink">
            Kelurahan {region.name}, Kec. {region.kecamatan}
          </p>
          <p className="num mt-0.5 text-[13px] text-ink-2">
            {fmtWeekLong(week)} · {fmtWeekRange(week)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DiseaseTag disease={a.disease} variant="chip" />
          <LevelBadge level={a.level} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-4 sm:p-5 md:grid-cols-3">
        <div>
          <h4 className="eyebrow mb-1">1 · Sinyal kasus</h4>
          <dl>
            <Row label="Kasus minggu ini" value={fmtInt(a.cases)} />
            <Row label="Kasus minggu lalu" value={fmtInt(a.casesPrev)} />
            <Row label="Rata-rata historis" value={fmtDec(a.expected, 1)} note="minggu kalender yang sama, tahun lain" />
            <Row label="Ambang" value={fmtDec(a.threshold, 1)} note="rata-rata + 2 simpangan baku" />
            <Row label="Skor-z" value={fmtDec(a.zScore, 1)} note="rata-rata 2 minggu vs historis" />
            <Row label="Skor sinyal" value={String(a.signals.kasus)} />
          </dl>
        </div>
        <div>
          <h4 className="eyebrow mb-1">2 · Sinyal cuaca</h4>
          <dl>
            <Row label="Hujan minggu ini" value={fmtRain(a.rainThisWeek)} />
            <Row label="Paparan hujan terkini" value={`${fmtDec(a.rainExposure, 0)} mm/mgg`} note={`bobot jeda ${d.short}: ${d.lagLabel}`} />
            <Row label="Paparan normal" value={`${fmtDec(a.rainExposureNormal, 0)} mm/mgg`} note="klimatologi periode yang sama" />
            <Row label="Dibanding normal" value={`${fmtDec(ratio, 1)}×`} />
            <Row label="Skor sinyal" value={String(a.signals.cuaca)} note="persentil terhadap riwayat" />
          </dl>
        </div>
        <div>
          <h4 className="eyebrow mb-1">3 · Sinyal tren</h4>
          <dl>
            <Row label="Kasus 3 minggu terakhir" value={fmtInt(a.casesRecent3)} />
            <Row label="Kasus 3 minggu sebelumnya" value={fmtInt(a.casesPrev3)} />
            <Row label="Skor sinyal" value={String(a.signals.tren)} note="40 = datar" />
          </dl>
        </div>
      </div>

      <div className="border-t border-line px-4 py-4 sm:px-5">
        <p className="num text-[14px] leading-7 text-ink">
          Skor = {fmtDec(w.kasus, 1)} × {a.signals.kasus} + {fmtDec(w.cuaca, 1)} × {a.signals.cuaca} + {fmtDec(w.tren, 1)} × {a.signals.tren} ={' '}
          <strong className="text-[18px] font-extrabold">{a.score}</strong>
          <span className="text-ink-2"> → {LEVELS[a.levelFromScore].label}</span>
        </p>
        <ScoreScale score={a.score} className="mt-3 max-w-xl" />
        {a.ruleNote && (
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-5 text-ink-2">
            <strong className="font-semibold text-ink">Aturan bukti kasus berlaku.</strong> {a.ruleNote}
          </p>
        )}
        <Link href={`/dashboard/wilayah/${region.id}`} className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-brand hover:text-brand-strong">
          Lihat profil lengkap kelurahan ini
          <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/** Contoh hitung langsung dari data minggu terakhir (bukan angka karangan di halaman). */
export function WorkedExample() {
  return (
    <DataGate fallback={<div className="skeleton h-[420px]" aria-busy="true" aria-label="Memuat contoh hitung" />}>
      <Example />
    </DataGate>
  );
}
