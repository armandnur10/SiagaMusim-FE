'use client';

import { useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Card, CardHeader, DataGate, DummyDataNote } from '@/components/ui';
import { DATA_URLS, DISEASES, DISEASE_IDS, RAIN } from '@/lib/config';
import { useDataset } from '@/lib/data/EwsDataProvider';
import { fmtDate, fmtDec, fmtInt, fmtWeekLong, fmtWeekRange } from '@/lib/format';
import { useFilters } from '@/lib/state/filters';

const DICTIONARY: { column: string; type: string; description: string; example: string }[] = [
  { column: 'tanggal', type: 'Tanggal', description: 'Hari pertama minggu pencatatan (Senin). Satu baris mewakili satu minggu penuh, Senin–Minggu.', example: '2026-10-26' },
  { column: 'tahun', type: 'Bilangan bulat', description: 'Tahun minggu epidemiologi (ISO 8601).', example: '2026' },
  { column: 'minggu_epi', type: 'Bilangan bulat', description: 'Nomor minggu epidemiologi dalam tahun tersebut (1–53).', example: '44' },
  { column: 'kota', type: 'Teks', description: 'Kota administrasi.', example: 'Jakarta Timur' },
  { column: 'kecamatan', type: 'Teks', description: 'Nama kecamatan (10 kecamatan).', example: 'Jatinegara' },
  { column: 'kelurahan', type: 'Teks', description: 'Nama kelurahan (65 kelurahan). Kunci penghubung ke berkas wilayah dan peta.', example: 'Kampung Melayu' },
  { column: 'curah_hujan_mm', type: 'Desimal', description: 'Akumulasi curah hujan selama minggu tersebut, dalam milimeter.', example: '168.4' },
  { column: 'insiden_dbd', type: 'Bilangan bulat', description: 'Jumlah kasus baru Demam Berdarah Dengue yang tercatat minggu itu.', example: '3' },
  { column: 'insiden_muntaber', type: 'Bilangan bulat', description: 'Jumlah kasus baru muntaber (diare akut) yang tercatat minggu itu.', example: '7' },
  { column: 'insiden_influenza', type: 'Bilangan bulat', description: 'Jumlah kasus baru influenza (penyakit serupa flu) yang tercatat minggu itu.', example: '5' },
];

const WILAYAH_DICTIONARY: { column: string; description: string }[] = [
  { column: 'id_kelurahan', description: 'Pengenal kelurahan (sama dengan properti id pada berkas peta GeoJSON).' },
  { column: 'kota, kecamatan, kelurahan', description: 'Hierarki administrasi.' },
  { column: 'penduduk', description: 'Jumlah penduduk (simulasi) — penyebut angka insidensi per 100.000.' },
  { column: 'luas_km2', description: 'Luas wilayah, dihitung dari poligon batas kelurahan.' },
  { column: 'lat, lon', description: 'Titik tengah kelurahan.' },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <dt className="text-[12px] font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 text-[20px] font-extrabold leading-7 tracking-tight text-ink">{value}</dd>
    </div>
  );
}

function DataContent() {
  const ds = useDataset();
  const { weekIndex, week } = useFilters();
  const [kecId, setKecId] = useState<string>('semua');

  const rows = useMemo(() => {
    const ids = kecId === 'semua' ? ds.kelurahanIds : ds.regions[kecId].childIds;
    return [...ids]
      .map((id) => ds.regions[id])
      .sort((a, b) => (a.kecamatan ?? '').localeCompare(b.kecamatan ?? '') || a.name.localeCompare(b.name))
      .map((r) => ({
        id: r.id,
        name: r.name,
        kecamatan: r.kecamatan ?? '',
        rain: ds.series[r.id].rain[weekIndex],
        dbd: ds.series[r.id].cases.dbd[weekIndex],
        muntaber: ds.series[r.id].cases.muntaber[weekIndex],
        influenza: ds.series[r.id].cases.influenza[weekIndex],
      }));
  }, [ds, kecId, weekIndex]);

  const totals = useMemo(
    () => rows.reduce((t, r) => ({ dbd: t.dbd + r.dbd, muntaber: t.muntaber + r.muntaber, influenza: t.influenza + r.influenza }), { dbd: 0, muntaber: 0, influenza: 0 }),
    [rows],
  );

  const first = ds.weeks[0];
  const last = ds.weeks[ds.latestWeek];

  return (
    <div className="grid grid-cols-1 gap-5">
      <DummyDataNote />

      <Card>
        <CardHeader
          title="Tentang dataset"
          subtitle="Deret waktu mingguan per kelurahan. Aplikasi membaca berkas CSV ini langsung di peramban, tanpa server."
        />
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Baris data" value={fmtInt(ds.weeks.length * ds.kelurahanIds.length)} />
          <Stat label="Minggu" value={fmtInt(ds.weeks.length)} />
          <Stat label="Kelurahan" value={fmtInt(ds.kelurahanIds.length)} />
          <Stat label="Kecamatan" value={fmtInt(ds.kecamatanIds.length)} />
        </dl>
        <p className="mt-4 text-[14px] leading-6 text-ink-2">
          Periode <strong className="font-semibold text-ink">{fmtDate(first.date)}</strong> sampai{' '}
          <strong className="font-semibold text-ink">{fmtDate(last.endDate)}</strong>. Satuan waktu mingguan dipilih karena surveilans
          penyakit menular lazim dilaporkan per minggu epidemiologi, dan hitungan harian per kelurahan terlalu kecil untuk dibaca polanya.
        </p>
        <p className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-ink-2">
          <RefreshCw size={15} className="mt-0.5 shrink-0" aria-hidden />
          Untuk memakai data lain, ganti kedua berkas di folder <code className="mx-1 font-mono text-[12px]">public/data</code> dengan
          struktur kolom yang sama. Seluruh peta, grafik, dan level peringatan akan menyesuaikan.
        </p>
      </Card>

      <Card>
        <CardHeader title="Kamus data" subtitle="Berkas ews_jakarta_timur_mingguan.csv" />
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-y border-line bg-surface-2 text-[12px] font-bold text-ink-2">
                <th scope="col" className="px-4 py-2.5 sm:px-5">Kolom</th>
                <th scope="col" className="px-3 py-2.5">Tipe</th>
                <th scope="col" className="px-3 py-2.5">Keterangan</th>
                <th scope="col" className="px-4 py-2.5 sm:px-5">Contoh</th>
              </tr>
            </thead>
            <tbody>
              {DICTIONARY.map((d) => (
                <tr key={d.column} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] font-semibold text-ink sm:px-5">{d.column}</th>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{d.type}</td>
                  <td className="px-3 py-2.5 leading-5 text-ink-2">{d.description}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-ink-2 sm:px-5">{d.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mt-5 text-[14px] font-bold text-ink">Berkas wilayah_jakarta_timur.csv</h3>
        <ul className="mt-2 grid gap-1.5 text-[13px] leading-5 text-ink-2">
          {WILAYAH_DICTIONARY.map((w) => (
            <li key={w.column}>
              <code className="font-mono text-[12px] font-semibold text-ink">{w.column}</code> — {w.description}
            </li>
          ))}
        </ul>
      </Card>

      <Card flush>
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <CardHeader
            title="Pratinjau data"
            subtitle={week ? `${fmtWeekLong(week)} · ${fmtWeekRange(week)}. Ganti minggu lewat penggeser di bilah atas.` : undefined}
            action={
              <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                Kecamatan
                <select className="field h-9 min-h-0" value={kecId} onChange={(e) => setKecId(e.target.value)}>
                  <option value="semua">Semua kecamatan</option>
                  {ds.kecamatanIds.map((id) => (
                    <option key={id} value={id}>{ds.regions[id].name}</option>
                  ))}
                </select>
              </label>
            }
          />
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-y border-line bg-surface-2 text-[12px] font-bold text-ink-2">
                <th scope="col" className="px-4 py-2.5 sm:px-5">Kelurahan</th>
                <th scope="col" className="px-3 py-2.5">Kecamatan</th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RAIN.color }} />
                    Hujan (mm)
                  </span>
                </th>
                {DISEASE_IDS.map((d) => (
                  <th key={d} scope="col" className="px-3 py-2.5 text-right last:pr-4 sm:last:pr-5">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DISEASES[d].color }} />
                      {DISEASES[d].short}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <th scope="row" className="px-4 py-2 font-semibold text-ink sm:px-5">{r.name}</th>
                  <td className="px-3 py-2 text-ink-2">{r.kecamatan}</td>
                  <td className="num px-3 py-2 text-right text-ink">{fmtDec(r.rain, 1)}</td>
                  <td className="num px-3 py-2 text-right text-ink">{fmtInt(r.dbd)}</td>
                  <td className="num px-3 py-2 text-right text-ink">{fmtInt(r.muntaber)}</td>
                  <td className="num px-3 py-2 pr-4 text-right text-ink sm:pr-5">{fmtInt(r.influenza)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="border-t border-line-strong bg-surface-2 font-bold text-ink">
                <th scope="row" className="px-4 py-2.5 sm:px-5">Jumlah kasus</th>
                <td className="px-3 py-2.5 font-medium text-muted">{fmtInt(rows.length)} kelurahan</td>
                <td className="px-3 py-2.5" />
                <td className="num px-3 py-2.5 text-right">{fmtInt(totals.dbd)}</td>
                <td className="num px-3 py-2.5 text-right">{fmtInt(totals.muntaber)}</td>
                <td className="num px-3 py-2.5 pr-4 text-right sm:pr-5">{fmtInt(totals.influenza)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function DataPage() {
  return (
    <>
      <PageHeader
        title="Data"
        description="Dataset di balik seluruh tampilan: struktur kolom, pratinjau per minggu, dan berkas mentah untuk diunduh."
        actions={
          <>
            <a className="btn btn-primary" href={DATA_URLS.timeseries} download>
              <Download size={16} aria-hidden />
              Deret waktu (CSV)
            </a>
            <a className="btn btn-ghost" href={DATA_URLS.wilayah} download>
              <Download size={16} aria-hidden />
              Wilayah (CSV)
            </a>
          </>
        }
      />
      <DataGate>
        <DataContent />
      </DataGate>
    </>
  );
}
