/** Kerangka pemuatan berbentuk halaman: baris filter, 4 angka, grafik utama, dua baris kartu, panel kecamatan. */
export function TrenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat data tren" className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="skeleton h-[62px] w-full sm:w-[280px]" />
        <div className="skeleton h-[62px] w-full sm:w-[340px]" />
        <div className="skeleton h-10 w-full sm:ml-auto sm:w-[200px]" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[124px]" />
        ))}
      </div>
      <div className="skeleton h-[560px] sm:h-[680px]" />
      <div className="skeleton h-[420px]" />
      <div className="skeleton h-[440px]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="skeleton h-[170px]" />
        ))}
      </div>
    </div>
  );
}
