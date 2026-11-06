/** Kerangka pemuatan yang mengikuti bentuk halaman Ringkasan, supaya tata letak tidak melompat saat data tiba. */
export function RingkasanSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat ringkasan" className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="skeleton h-[292px] !rounded-[14px]" />
        <div className="skeleton h-[292px] !rounded-[14px]" />
        <div className="skeleton h-[292px] !rounded-[14px]" />
      </div>
      <div className="skeleton h-[148px] !rounded-[14px]" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="skeleton order-2 h-[460px] !rounded-[14px] xl:order-1 xl:col-span-7 xl:h-[640px]" />
        <div className="skeleton order-1 h-[560px] !rounded-[14px] xl:order-2 xl:col-span-5 xl:h-[640px]" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="skeleton h-[520px] !rounded-[14px] xl:col-span-8" />
        <div className="skeleton h-[360px] !rounded-[14px] xl:col-span-4 xl:h-[520px]" />
      </div>
      <div className="skeleton h-[560px] !rounded-[14px]" />
    </div>
  );
}
