import clsx from 'clsx';
import { APP_NAME } from '@/lib/config';

/** Tanda merek: tetes hujan dengan garis denyut — "cuaca -> kesehatan". */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0B5A63" />
      <path d="M16 5.5c3.6 4.3 6.5 7.9 6.5 11.6a6.5 6.5 0 0 1-13 0c0-3.7 2.9-7.3 6.5-11.6Z" fill="#E0F0EF" />
      <path d="M10.5 18h2.6l1.5-3.2 2.4 5.6 1.5-2.4h3" fill="none" stroke="#0B5A63" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="leading-none">
        <span className={clsx('block text-[16px] font-extrabold tracking-tight', onDark ? 'text-white' : 'text-ink')}>{APP_NAME}</span>
        <span className={clsx('mt-1 block text-[10.5px] font-semibold uppercase tracking-[0.08em]', onDark ? 'text-white/60' : 'text-muted')}>
          EWS Jakarta Timur
        </span>
      </span>
    </span>
  );
}
