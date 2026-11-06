import clsx from 'clsx';
import { FlaskConical } from 'lucide-react';

/** Pil kecil penanda data simulasi — tampil di setiap layar agar tidak disalahartikan sebagai data resmi. */
export function DummyDataPill({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span
      title="Seluruh angka pada prototype ini adalah data simulasi, bukan data surveilans atau BMKG resmi."
      className={clsx(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold whitespace-nowrap',
        onDark ? 'border-white/25 text-white/85' : 'border-line-strong bg-surface text-ink-2',
        className,
      )}
    >
      <FlaskConical size={13} strokeWidth={2.25} aria-hidden />
      Data simulasi
    </span>
  );
}

/** Catatan lebih panjang untuk halaman publik/metodologi. */
export function DummyDataNote({ className }: { className?: string }) {
  return (
    <p className={clsx('flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[13px] leading-5 text-ink-2', className)}>
      <FlaskConical size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        <strong className="font-semibold text-ink">Prototype dengan data simulasi.</strong> Angka kasus dan curah hujan dibuat secara sintetis
        untuk mendemonstrasikan cara kerja sistem. Jangan gunakan sebagai dasar keputusan kesehatan yang sebenarnya.
      </span>
    </p>
  );
}
