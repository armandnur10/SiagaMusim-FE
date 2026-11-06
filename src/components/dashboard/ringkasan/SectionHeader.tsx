import clsx from 'clsx';

interface SectionHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Tautan/kontrol di kanan judul. Tidak pernah turun ke bawah subjudul pada layar ≥ sm. */
  action?: React.ReactNode;
  id?: string;
  className?: string;
}

/**
 * Judul kartu dengan tipografi yang sama seperti `CardHeader`, tetapi aksi di kanan tetap sebaris
 * dengan judul walau subjudulnya panjang (di ponsel aksi turun ke bawah subjudul).
 */
export function SectionHeader({ title, subtitle, action, id, className }: SectionHeaderProps) {
  return (
    <header className={clsx('mb-4 flex flex-col gap-x-6 gap-y-2 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[16px] font-bold leading-6 text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 max-w-[34rem] text-[13px] leading-5 text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Kelas tautan teks "lanjut ke halaman lain" yang dipakai di seluruh halaman Ringkasan. */
export const MORE_LINK =
  'inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg text-[13px] font-semibold text-brand hover:text-brand-strong hover:underline sm:h-6';
