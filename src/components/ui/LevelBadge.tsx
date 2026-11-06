import clsx from 'clsx';
import { LEVELS } from '@/lib/config';
import type { AlertLevel } from '@/types/ews';
import { LEVEL_ICONS } from './icons';

interface LevelBadgeProps {
  level: AlertLevel;
  /** sm = baris tabel, md = kartu, lg = judul status. */
  size?: 'sm' | 'md' | 'lg';
  /** soft = latar lembut + teks gelap (default); solid = isian penuh warna level. */
  variant?: 'soft' | 'solid';
  className?: string;
}

const SIZE = {
  sm: { box: 'h-6 px-2 text-[12px] gap-1', icon: 13 },
  md: { box: 'h-7 px-2.5 text-[13px] gap-1.5', icon: 15 },
  lg: { box: 'h-9 px-3.5 text-[15px] gap-2', icon: 18 },
} as const;

/** Lencana level peringatan: ikon + label (tidak pernah warna saja). */
export function LevelBadge({ level, size = 'md', variant = 'soft', className }: LevelBadgeProps) {
  const cfg = LEVELS[level];
  const Icon = LEVEL_ICONS[level];
  const s = SIZE[size];
  const style =
    variant === 'solid'
      ? { backgroundColor: cfg.color, color: cfg.onColor }
      : { backgroundColor: cfg.colorSoft, color: cfg.colorText };
  return (
    <span className={clsx('inline-flex items-center rounded-full font-bold whitespace-nowrap', s.box, className)} style={style}>
      <Icon size={s.icon} strokeWidth={2.25} aria-hidden />
      {cfg.label}
    </span>
  );
}

/** Titik warna level (untuk legenda ringkas). Pasangkan dengan teks. */
export function LevelDot({ level, size = 10 }: { level: AlertLevel; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: LEVELS[level].color }}
    />
  );
}
