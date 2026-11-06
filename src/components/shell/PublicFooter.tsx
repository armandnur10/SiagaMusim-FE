import Link from 'next/link';
import { Logo } from './Logo';

export function PublicFooter() {
  return (
    <footer className="mt-16 bg-brand-deep text-white/75">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo onDark />
          <p className="mt-4 max-w-md text-[13px] leading-6">
            Prototype sistem peringatan dini yang menghubungkan curah hujan dengan potensi lonjakan DBD, muntaber, dan influenza
            per kelurahan di Jakarta Timur.
          </p>
        </div>
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/50">Jelajahi</h2>
          <ul className="mt-3 grid gap-2 text-[14px] font-medium">
            <li><Link className="hover:text-white" href="/">Status terkini</Link></li>
            <li><Link className="hover:text-white" href="/dashboard">Dasbor pemantauan</Link></li>
            <li><Link className="hover:text-white" href="/dashboard/peta">Peta risiko</Link></li>
            <li><Link className="hover:text-white" href="/metodologi">Metodologi</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/50">Catatan data</h2>
          <p className="mt-3 text-[13px] leading-6">
            Seluruh angka kasus dan curah hujan adalah <strong className="font-semibold text-white">data simulasi</strong>, bukan data resmi
            Dinas Kesehatan atau BMKG. Batas wilayah © kontributor OpenStreetMap (ODbL).
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto w-full max-w-[1200px] px-4 py-4 text-[12px] text-white/50 sm:px-6">
          Siaga Musim · Prototype frontend · Bukan layanan kesehatan resmi. Dalam keadaan darurat hubungi 112 atau fasilitas kesehatan terdekat.
        </p>
      </div>
    </footer>
  );
}
