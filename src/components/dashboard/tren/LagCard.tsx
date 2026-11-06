'use client';

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { LagCorrelationChart } from '@/components/charts';
import { Card, CardHeader } from '@/components/ui';
import { DISEASES } from '@/lib/config';
import { lagCorrelation } from '@/lib/engines/lag';
import { fmtDec, fmtInt, fmtWeekLong } from '@/lib/format';
import type { Dataset, DiseaseId } from '@/types/ews';
import { correlationStrength, regionTitle } from './helpers';

const MAX_LAG = 12;

interface LagCardProps {
  ds: Dataset;
  regionId: string;
  disease: DiseaseId;
  onRegionChange: (id: string) => void;
}

/** "Berapa minggu hujan mendahului kasus?" - korelasi silang dari seluruh riwayat + penjelasan. */
export function LagCard({ ds, regionId, disease, onRegionChange }: LagCardProps) {
  const d = DISEASES[disease];
  const region = ds.regions[regionId];
  const lag = useMemo(() => lagCorrelation(ds, regionId, disease, MAX_LAG), [ds, regionId, disease]);

  const stats = useMemo(() => {
    const y = ds.series[regionId].cases[disease];
    const meanCases = y.length > 0 ? y.reduce((s, v) => s + v, 0) / y.length : 0;
    const inWindowPts = lag.points.filter((p) => d.lags.includes(p.lag));
    const windowR = inWindowPts.length > 0 ? inWindowPts.reduce((s, p) => s + p.r, 0) / inWindowPts.length : null;
    return { meanCases, windowR };
  }, [ds, regionId, disease, lag, d.lags]);

  const hasSignal = Number.isFinite(lag.bestR) && lag.bestR > 0.05;
  const inWindow = d.lags.includes(lag.bestLag);
  const minLag = Math.min(...d.lags);
  const noisy = region.kind === 'kelurahan' || stats.meanCases < 3;
  const parent = region.kecamatanId ? ds.regions[region.kecamatanId] : null;
  const first = ds.weeks[0];
  const last = ds.weeks[ds.latestWeek];

  const lagPhrase = lag.bestLag === 0 ? 'minggu yang sama (jeda 0 minggu)' : `jeda ${fmtInt(lag.bestLag)} minggu`;

  return (
    <Card>
      <CardHeader
        title="Berapa minggu hujan mendahului kasus?"
        subtitle={`Tiap batang menunjukkan seberapa erat kasus ${d.short} bergerak bersama hujan beberapa minggu sebelumnya; batang tertinggi adalah jeda yang paling cocok.`}
      />
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <LagCorrelationChart points={lag.points} bestLag={lag.bestLag} disease={disease} height={300} />
          <p className="mt-2 text-[12.5px] leading-[18px] text-muted">
            Dihitung dari seluruh riwayat data {regionTitle(region)} ({fmtWeekLong(first)} sampai {fmtWeekLong(last)},{' '}
            {fmtInt(ds.weeks.length)} minggu), tidak mengikuti rentang atau minggu yang dipilih di atas.
          </p>
        </div>

        <div className="min-w-0 lg:col-span-2">
          {hasSignal ? (
            <>
              <h3 className="text-[16px] font-bold leading-6 text-ink">
                Korelasi tertinggi pada {lagPhrase} (r = {fmtDec(lag.bestR, 2)})
              </h3>
              <p className="mt-2 text-[14px] leading-6 text-ink-2">
                Hubungannya tergolong <strong className="font-semibold text-ink">{correlationStrength(lag.bestR)}</strong>: nilai r mendekati 1
                berarti hujan dan kasus naik-turun bersama, mendekati 0 berarti tidak terkait.{' '}
                {inWindow ? (
                  <>
                    Jeda ini berada di dalam jendela {d.lagLabel} yang dipakai mesin risiko
                    {lag.bestR >= 0.35
                      ? ', sehingga data sejalan dengan asumsi tersebut.'
                      : ', tetapi hubungannya terlalu lemah untuk dijadikan penguat asumsi tersebut.'}
                  </>
                ) : (
                  <>
                    Jeda ini {lag.bestLag < minLag ? 'lebih pendek' : 'lebih panjang'} dari jendela {d.lagLabel} yang dipakai mesin risiko.
                    Jendela itu ditetapkan dari mekanisme penyakit, bukan dicocokkan ke data ini
                    {stats.windowR !== null && <> (di dalam jendela, r rata-rata {fmtDec(stats.windowR, 2)})</>}.
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <h3 className="text-[16px] font-bold leading-6 text-ink">Tidak terlihat hubungan yang jelas</h3>
              <p className="mt-2 text-[14px] leading-6 text-ink-2">
                Pada semua jeda 0–{MAX_LAG} minggu, korelasi hujan dan kasus {d.short} di wilayah ini mendekati nol. Mesin risiko tetap memakai
                jendela {d.lagLabel} yang ditetapkan dari mekanisme penyakit.
              </p>
            </>
          )}

          <h4 className="mt-4 text-[13px] font-bold leading-5 text-ink">Mengapa ada jeda</h4>
          <p className="mt-1 text-[13.5px] leading-[22px] text-ink-2">{d.mechanism}</p>

          <p className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[13px] leading-5 text-ink-2">
            <Info size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
            <span>Korelasi bukan bukti sebab-akibat; pola musiman bersama ikut menaikkan nilainya.</span>
          </p>

          {noisy && (
            <p className="mt-3 text-[13px] leading-5 text-ink-2">
              Di wilayah sekecil ini kasus per minggu sangat sedikit (rata-rata {fmtDec(stats.meanCases, 1)}), sehingga korelasinya lebih
              berisik. Tampilan kota atau kecamatan lebih dapat diandalkan.{' '}
              {parent && (
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center font-semibold text-brand underline decoration-1 underline-offset-2 hover:text-brand-strong sm:min-h-0"
                  onClick={() => onRegionChange(parent.id)}
                >
                  Lihat {regionTitle(parent)}
                </button>
              )}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
