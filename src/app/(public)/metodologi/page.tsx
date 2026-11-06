import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { WorkedExample } from '@/components/public/WorkedExample';
import { DISEASE_ICONS, DummyDataNote, LevelBadge } from '@/components/ui';
import { DISEASES, DISEASE_IDS, LEVELS, LEVEL_ORDER, SCORE_WEIGHTS } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Metodologi',
  description: 'Cara Siaga Musim menghitung level peringatan: tiga sinyal, satu skor, empat level, dan keterbatasannya.',
};

const MAX_LAG = 10;

/** Garis waktu jeda: minggu 0 = hujan turun, pita berwarna = jendela saat kasus biasanya muncul. */
function LagTimeline() {
  return (
    <div className="card p-4 sm:p-5">
      <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 sm:grid-cols-[120px_minmax(0,1fr)]">
        {DISEASE_IDS.map((id) => {
          const d = DISEASES[id];
          const from = Math.min(...d.lags);
          const to = Math.max(...d.lags) + 1;
          return (
            <div key={id} className="contents">
              <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.short}
              </div>
              <div
                className="relative h-8 rounded-md bg-sunken"
                role="img"
                aria-label={`${d.short}: kasus biasanya muncul ${d.lagLabel} setelah hujan`}
              >
                <div
                  className="absolute inset-y-0 flex items-center justify-center rounded-md text-[12px] font-bold"
                  style={{
                    left: `${(from / MAX_LAG) * 100}%`,
                    width: `${((to - from) / MAX_LAG) * 100}%`,
                    backgroundColor: d.color,
                    color: '#fff',
                  }}
                >
                  <span className="truncate px-1">{d.lagLabel}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div />
        <div className="num relative h-5 text-[11px] font-medium text-muted" aria-hidden>
          {Array.from({ length: MAX_LAG + 1 }, (_, i) => (
            <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(i / MAX_LAG) * 100}%` }}>
              {i}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-muted">
        Minggu setelah hujan turun (0 = minggu yang sama). Pita berwarna menandai kapan kasus biasanya muncul.
      </p>
    </div>
  );
}

const SIGNALS = [
  {
    key: 'kasus' as const,
    title: 'Sinyal kasus',
    question: 'Apakah kasus lebih banyak dari biasanya?',
    body: 'Rata-rata kasus dua minggu terakhir dibandingkan dengan pola historis wilayah itu: rata-rata kasus pada minggu kalender yang sama (±2 minggu) di tahun-tahun lain. Semakin jauh di atas pola historis, semakin tinggi skornya.',
    formula: 'z = (kasus − rata-rata historis) ÷ simpangan baku\nskor = 20 + 27,5 × z',
  },
  {
    key: 'cuaca' as const,
    title: 'Sinyal cuaca',
    question: 'Apakah hujan baru-baru ini mendukung penularan?',
    body: 'Curah hujan beberapa minggu terakhir dirata-rata dengan bobot yang mengikuti jeda khas tiap penyakit, lalu dibandingkan dengan seluruh riwayat hujan wilayah itu. Ini indikator pendahulu: hujannya sudah turun, kasusnya belum tentu muncul.',
    formula: 'paparan = rata-rata tertimbang hujan terkini\nskor = persentil paparan (0–100)',
  },
  {
    key: 'tren' as const,
    title: 'Sinyal tren',
    question: 'Apakah kasus sedang menanjak?',
    body: 'Jumlah kasus tiga minggu terakhir dibandingkan dengan tiga minggu sebelumnya. Kenaikan pada angka yang sangat kecil (misalnya dari 1 menjadi 2 kasus) diredam supaya tidak memicu alarm palsu.',
    formula: 'g = (3 mgg terakhir − 3 mgg sebelumnya) ÷ 3 mgg sebelumnya\nskor = 40 + 60 × g × peredam',
  },
];

const LIMITS = [
  'Seluruh data adalah simulasi. Pola jeda hujan–kasus sengaja ditanam di dalamnya, sehingga korelasi yang tampak lebih rapi daripada data nyata.',
  'Pola historis hanya dibangun dari dua tahun pembanding. Sistem surveilans nyata lazim memakai lima tahun atau lebih.',
  'Ambang dan bobot skor belum dikalibrasi terhadap kejadian luar biasa yang sebenarnya.',
  'Proyeksi empat minggu bersifat indikatif, bukan model prediksi yang sudah divalidasi.',
  'Faktor lain belum diperhitungkan: suhu, kelembapan, mobilitas penduduk, cakupan pemberantasan sarang nyamuk, kualitas air, dan keterlambatan pelaporan.',
  'Kasus di tingkat kelurahan berjumlah kecil, sehingga status mingguan bisa berubah-ubah. Baca bersama tren dan status kecamatan.',
];

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-1 text-[22px] font-extrabold leading-8 tracking-tight text-ink sm:text-[26px] sm:leading-9">{title}</h2>
      {children && <p className="mt-2 text-[15px] leading-7 text-ink-2">{children}</p>}
    </div>
  );
}

export default function MetodologiPage() {
  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      <header className="max-w-3xl">
        <p className="eyebrow">Metodologi</p>
        <h1 className="mt-2 text-[30px] font-extrabold leading-[1.15] tracking-tight text-ink sm:text-[40px]">
          Bagaimana level peringatan dihitung
        </h1>
        <p className="mt-4 text-[16px] leading-7 text-ink-2 sm:text-[17px] sm:leading-8">
          Siaga Musim membaca dua hal setiap minggu, untuk setiap kelurahan: berapa kasus yang tercatat, dan berapa banyak hujan yang turun.
          Keduanya digabung menjadi satu skor risiko dengan rumus terbuka yang bisa Anda periksa di halaman ini.
        </p>
        <DummyDataNote className="mt-6" />
      </header>

      <section className="mt-14">
        <SectionTitle eyebrow="Dasar pemikiran" title="Hujan datang lebih dulu, kasus menyusul">
          Hujan tidak langsung membuat orang sakit. Ada jeda antara hujan dan munculnya kasus, dan lamanya berbeda untuk tiap penyakit.
          Jeda itulah yang memberi waktu untuk bertindak.
        </SectionTitle>
        <LagTimeline />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {DISEASE_IDS.map((id) => {
            const d = DISEASES[id];
            const Icon = DISEASE_ICONS[id];
            return (
              <article key={id} className="card p-4 sm:p-5">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: d.colorSoft, color: d.colorText }}
                >
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="mt-3 text-[16px] font-bold text-ink">{d.name}</h3>
                <p className="mt-0.5 text-[13px] font-semibold text-muted">{d.transmission}</p>
                <p className="mt-2.5 text-[14px] leading-6 text-ink-2">{d.mechanism}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-16">
        <SectionTitle eyebrow="Perhitungan" title="Tiga sinyal, satu skor">
          Setiap sinyal bernilai 0 sampai 100. Skor risiko adalah gabungan ketiganya dengan bobot tetap.
        </SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SIGNALS.map((s) => (
            <article key={s.key} className="card flex flex-col p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[16px] font-bold text-ink">{s.title}</h3>
                <span className="num text-[13px] font-bold text-brand">bobot {Math.round(SCORE_WEIGHTS[s.key] * 100)}%</span>
              </div>
              <p className="mt-1 text-[14px] font-semibold leading-6 text-ink">{s.question}</p>
              <p className="mt-2 flex-1 text-[14px] leading-6 text-ink-2">{s.body}</p>
              <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2.5 font-mono text-[12px] leading-5 text-ink-2">{s.formula}</pre>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-[14px] bg-brand-deep px-5 py-5 text-white sm:px-6">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/55">Skor risiko</p>
          <p className="num mt-1.5 text-[18px] font-bold leading-8 sm:text-[22px]">
            0,5 × Kasus + 0,3 × Cuaca + 0,2 × Tren
          </p>
        </div>
      </section>

      <section className="mt-16">
        <SectionTitle eyebrow="Hasil" title="Empat level peringatan">
          Skor diterjemahkan menjadi empat level yang sudah dikenal dari peringatan bencana di Indonesia.
        </SectionTitle>
        <div className="card overflow-hidden">
          <ul>
            {[...LEVEL_ORDER].reverse().map((id, i, arr) => {
              const lv = LEVELS[id];
              const idx = LEVEL_ORDER.indexOf(id);
              const upper = idx < LEVEL_ORDER.length - 1 ? LEVELS[LEVEL_ORDER[idx + 1]].minScore - 1 : 100;
              return (
                <li
                  key={id}
                  className={`grid grid-cols-[minmax(0,1fr)] items-center gap-x-5 gap-y-1.5 px-4 py-4 sm:grid-cols-[130px_96px_minmax(0,1fr)] sm:px-5 ${i < arr.length - 1 ? 'border-b border-line' : ''}`}
                >
                  <div><LevelBadge level={id} size="lg" variant="solid" /></div>
                  <p className="num text-[14px] font-bold text-ink">Skor {lv.minScore}–{upper}</p>
                  <p className="text-[14px] leading-6 text-ink-2">{lv.meaning}</p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-4 card p-4 sm:p-5">
          <h3 className="text-[16px] font-bold text-ink">Aturan bukti kasus</h3>
          <p className="mt-1 text-[14px] leading-6 text-ink-2">
            Musim hujan datang setiap tahun. Supaya peringatan tidak menyala hanya karena hujan, tiga aturan ini selalu diterapkan setelah skor dihitung:
          </p>
          <ol className="mt-3 grid gap-2.5 text-[14px] leading-6 text-ink">
            <li className="flex gap-3"><span className="num font-bold text-brand">1</span><span><strong className="font-semibold">Cuaca saja paling tinggi menghasilkan Waspada.</strong> Siaga mensyaratkan kasus teramati di atas rata-rata historis, termasuk pada minggu berjalan.</span></li>
            <li className="flex gap-3"><span className="num font-bold text-brand">2</span><span><strong className="font-semibold">Awas mensyaratkan kasus melampaui ambang</strong> (rata-rata historis ditambah dua simpangan baku).</span></li>
            <li className="flex gap-3"><span className="num font-bold text-brand">3</span><span><strong className="font-semibold">Dua minggu berturut-turut di atas ambang berarti minimal Siaga,</strong> berapa pun skornya.</span></li>
          </ol>
        </div>
      </section>

      <section className="mt-16">
        <SectionTitle eyebrow="Contoh hitung" title="Satu kelurahan, langkah demi langkah">
          Angka di bawah diambil langsung dari data minggu terakhir, untuk kelurahan dengan skor tertinggi.
        </SectionTitle>
        <WorkedExample />
      </section>

      <section className="mt-16">
        <SectionTitle eyebrow="Ke depan" title="Proyeksi empat minggu">
          Selain status minggu ini, dasbor menampilkan perkiraan kasus empat minggu ke depan beserta rentang ketidakpastiannya.
        </SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="card p-4 sm:p-5">
            <h3 className="text-[16px] font-bold text-ink">Cara kerjanya</h3>
            <p className="mt-2 text-[14px] leading-6 text-ink-2">
              Titik awalnya adalah kasus yang biasa terjadi pada minggu tersebut. Angka itu lalu disesuaikan dengan dua hal: seberapa tinggi
              kasus saat ini dibanding biasanya, dan seberapa banyak hujan yang sudah turun dibanding normalnya. Untuk minggu depan,
              kondisi kasus saat ini paling menentukan. Semakin jauh ke depan, hujan semakin menentukan.
            </p>
          </div>
          <div className="card p-4 sm:p-5">
            <h3 className="text-[16px] font-bold text-ink">Mengapa paling berguna untuk DBD</h3>
            <p className="mt-2 text-[14px] leading-6 text-ink-2">
              Kasus DBD empat minggu ke depan dipicu oleh hujan yang turun hari ini sampai lima minggu lalu, dan hujan itu sudah tercatat.
              Jadi proyeksi DBD tidak bergantung pada prakiraan cuaca. Untuk muntaber dan influenza jedanya pendek, sehingga hujan yang
              belum terjadi diisi dengan rata-rata musimannya dan rentang ketidakpastiannya lebih lebar.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <SectionTitle eyebrow="Batasan" title="Yang perlu Anda ketahui sebelum memakai angka ini" />
        <div className="card p-4 sm:p-5">
          <ul className="grid gap-3">
            {LIMITS.map((t) => (
              <li key={t} className="flex gap-3 text-[14px] leading-6 text-ink-2">
                <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-2" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-[13px] leading-6 text-muted">
          Batas kelurahan dan kecamatan berasal dari OpenStreetMap (© kontributor OpenStreetMap, lisensi ODbL). Satuan waktu memakai minggu
          ISO 8601 (Senin–Minggu). Insidensi dinyatakan per 100.000 penduduk per minggu.
        </p>
      </section>

      <section className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-line bg-surface px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-[18px] font-bold text-ink">Lihat penerapannya pada data</h2>
          <p className="mt-0.5 text-[14px] text-ink-2">Peta risiko, tren hujan dan kasus, serta profil tiap kelurahan.</p>
        </div>
        <Link href="/dashboard" className="btn btn-primary">
          Buka dasbor
          <ArrowRight size={16} aria-hidden />
        </Link>
      </section>
    </div>
  );
}
