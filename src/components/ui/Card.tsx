import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article';
  /** Hilangkan padding bawaan (mis. kartu berisi peta/tabel penuh). */
  flush?: boolean;
}

/** Kartu standar. Padding bawaan 20px (16px di layar kecil). */
export function Card({ as: Tag = 'section', flush = false, className, children, ...rest }: CardProps) {
  return (
    <Tag className={clsx('card', !flush && 'p-4 sm:p-5', className)} {...rest}>
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: string;
  /** Satu kalimat penjelas di bawah judul. */
  subtitle?: React.ReactNode;
  /** Label kecil di atas judul. */
  eyebrow?: string;
  /** Kontrol di sisi kanan (tautan, toggle, dsb.). */
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, eyebrow, action, className }: CardHeaderProps) {
  return (
    <header className={clsx('mb-4 flex flex-col gap-x-4 gap-y-2 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="text-[16px] font-bold leading-6 text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
