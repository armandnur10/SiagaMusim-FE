'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { RainCaseChart } from '@/components/charts';
import { DISEASE_ICONS } from '@/components/ui';
import { CITY_NAME, DISEASES, DISEASE_IDS } from '@/lib/config';
import { useDataset } from '@/lib/data/EwsDataProvider';
import type { DiseaseId } from '@/types/ews';
import { DiseaseSwitch, QuietGate } from './parts';
import { SectionHeading } from './SectionHeading';

/** Jeda hujan -> kasus dalam satu kalimat awam (angka jedanya tetap dari konfigurasi). */
const DELAY: Record<DiseaseId, (lag: string) => string> = {
  dbd: (lag) => `Kasus biasanya baru naik ${lag} setelah hujan, karena nyamuk perlu waktu untuk berkembang biak di genangan.`,
  muntaber: (lag) => `Kasus bisa naik cepat, ${lag} setelah hujan sangat lebat, saat air kotor mencemari sumur dan makanan.`,
  influenza: (lag) => `Kasus biasanya menyusul ${lag} setelah periode hujan, saat udara lembap dan orang lebih sering berkumpul di dalam ruangan.`,
};

const WEEKS_SHOWN = 78;
const CHART_HEIGHT = 340;

function Chart({ disease }: { disease: DiseaseId }) {
  const ds = useDataset();
  const city = ds.series[ds.cityId];
  const to = ds.latestWeek;
  const from = Math.max(0, to - WEEKS_SHOWN + 1);
  return (
    <RainCaseChart
      weeks={ds.weeks}
      rain={city.rain}
      cases={city.cases[disease]}
      disease={disease}
      range={{ from, to }}
      height={CHART_HEIGHT}
      ariaLabel={`Curah hujan mingguan dan kasus ${DISEASES[disease].short} di ${CITY_NAME}, ${to - from + 1} minggu terakhir`}
    />
  );
}

/** "Hujan datang lebih dulu, kasus menyusul" untuk pembaca awam, dengan satu grafik contoh tingkat kota. */
export function RainExplainer() {
  const [disease, setDisease] = useState<DiseaseId>('dbd');
  return (
    <section aria-labelledby="hujan-title">
      <SectionHeading id="hujan-title" eyebrow="Mengapa hujan penting" title="Hujan turun lebih dulu, kasus menyusul kemudian" className="mb-6">
        Hujan tidak langsung membuat orang sakit. Ada jeda sebelum kasus muncul, dan jeda itu memberi waktu untuk bersiap.
      </SectionHeading>

      <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,372px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <ul className="divide-y divide-line border-y border-line">
            {DISEASE_IDS.map((id) => {
              const d = DISEASES[id];
              const Icon = DISEASE_ICONS[id];
              return (
                <li key={id} className="flex gap-3.5 py-4">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: d.colorSoft, color: d.colorText }}
                  >
                    <Icon size={20} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold leading-6 text-ink">{d.name}</h3>
                    <p className="text-[13px] font-semibold leading-5 text-muted">{d.transmission}</p>
                    <p className="mt-1.5 text-[14px] leading-6 text-ink-2">{DELAY[id](d.lagLabel)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link
            href="/metodologi"
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-bold text-brand hover:text-brand-strong"
          >
            Baca cara penghitungannya
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>

        <div className="card min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-6 text-ink">
                Hujan dan kasus {DISEASES[disease].short} di {CITY_NAME}
              </h3>
              <p className="mt-0.5 text-[13px] leading-5 text-ink-2">Seluruh kota, satu setengah tahun terakhir.</p>
            </div>
            <DiseaseSwitch value={disease} onChange={setDisease} label="Penyakit pada grafik" className="flex w-full sm:inline-flex sm:w-auto" />
          </div>
          <QuietGate fallback={<div aria-busy="true" aria-label="Memuat grafik" className="skeleton" style={{ height: CHART_HEIGHT + 28 }} />}>
            <Chart disease={disease} />
          </QuietGate>
          <p className="mt-3 border-t border-line pt-3 text-[13px] leading-5 text-ink-2">
            Arahkan kursor atau ketuk grafik: pita di panel hujan menunjukkan hujan yang memicu kasus minggu itu.
          </p>
        </div>
      </div>
    </section>
  );
}
