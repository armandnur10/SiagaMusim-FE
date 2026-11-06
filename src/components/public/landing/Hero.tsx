import { APP_NAME, CITY_NAME } from '@/lib/config';
import { KelurahanSearch } from './KelurahanSearch';
import { StatusPanel } from './StatusPanel';
import { WeekLabel } from './WeekLabel';

/** Hero: apa layanan ini, lalu langsung "cek kelurahan saya" dengan hasil di sampingnya. */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="grid grid-cols-1 items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,472px)] xl:gap-x-14"
    >
      <div className="min-w-0 lg:pt-3">
        <WeekLabel />
        <h1
          id="hero-title"
          className="mt-3 max-w-[20ch] text-balance text-[30px] font-extrabold leading-[1.15] tracking-tight text-ink sm:text-[38px] lg:text-[44px] lg:leading-[1.1]"
        >
          Pantau risiko penyakit musim hujan di kelurahan Anda
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-7 text-ink-2 sm:text-[17px] sm:leading-8">
          Setiap minggu, {APP_NAME} membaca curah hujan dan jumlah kasus di {CITY_NAME}, lalu menandai kelurahan yang perlu lebih
          waspada terhadap DBD, muntaber, dan influenza.
        </p>
        <div className="mt-8 max-w-xl">
          <KelurahanSearch />
        </div>
      </div>
      <StatusPanel />
    </section>
  );
}
