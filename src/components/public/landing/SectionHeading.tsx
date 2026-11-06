import clsx from 'clsx';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  id?: string;
  className?: string;
}

/** Judul bagian — skala huruf sama dengan halaman Metodologi supaya terasa satu produk. */
export function SectionHeading({ eyebrow, title, children, id, className }: SectionHeadingProps) {
  return (
    <div className={clsx('max-w-3xl', className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-1 text-[22px] font-extrabold leading-8 tracking-tight text-ink sm:text-[26px] sm:leading-9">
        {title}
      </h2>
      {children && <p className="mt-2 text-[15px] leading-7 text-ink-2">{children}</p>}
    </div>
  );
}
