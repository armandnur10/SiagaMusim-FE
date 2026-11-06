import Link from 'next/link';
import { ArrowRight, ChartLine, ClipboardList, Map, type LucideIcon } from 'lucide-react';

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Map,
    title: 'Peta risiko per kelurahan',
    body: 'Level peringatan, insidensi, dan curah hujan 65 kelurahan dalam satu peta.',
  },
  {
    icon: ChartLine,
    title: 'Tren hujan dan kasus, dengan proyeksi 4 minggu',
    body: 'Lihat kapan hujan mulai berdampak pada kasus dan ke mana arahnya sebulan ke depan.',
  },
  {
    icon: ClipboardList,
    title: 'Profil dan rekomendasi per wilayah',
    body: 'Rincian sinyal tiap kelurahan, beserta langkah yang disarankan untuk Puskesmas dan kelurahan.',
  },
];

/** Blok gelap penutup: ajakan ke dasbor bagi dinas & pengambil kebijakan. */
export function OfficialsBand() {
  return (
    <section aria-labelledby="dinas-title" className="rounded-[14px] bg-brand-deep px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-10">
      <div className="grid grid-cols-1 items-start gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-white/55">Untuk dinas &amp; pengambil kebijakan</p>
          <h2 id="dinas-title" className="mt-2 text-[22px] font-extrabold leading-8 tracking-tight sm:text-[26px] sm:leading-9">
            Tentukan wilayah prioritas sebelum kasus melonjak
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-7 text-white/75">
            Dasbor pemantauan merangkum hujan, kasus, dan proyeksi tiap wilayah, supaya tindakan pencegahan bisa diarahkan lebih awal.
          </p>
          <Link
            href="/dashboard"
            className="btn mt-6 min-h-[48px] bg-white px-5 text-[15px] text-brand-deep hover:bg-white/90 focus-visible:outline-white"
          >
            Buka dasbor
            <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
        <ul className="min-w-0 divide-y divide-white/10 border-y border-white/10">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                <Icon size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold leading-6">{title}</h3>
                <p className="mt-0.5 text-[14px] leading-6 text-white/70">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
