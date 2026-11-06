import type { Metadata } from 'next';
import { RegionProfile } from '@/components/dashboard/wilayah/RegionProfile';

type Props = { params: Promise<{ id: string }> };

/** "kampung-melayu" -> "Kampung Melayu", "kec-jatinegara" -> "Kec. Jatinegara", "kota-jakarta-timur" -> "Jakarta Timur". */
function titleFromId(id: string): string {
  const words = (s: string) =>
    s
      .split('-')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  if (id.startsWith('kec-')) return `Kec. ${words(id.slice(4))}`;
  if (id.startsWith('kota-')) return words(id.slice(5));
  return words(id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const safe = /^[a-z0-9-]{1,60}$/.test(id) ? titleFromId(id) : '';
  return { title: safe ? `${safe} · Wilayah` : 'Profil wilayah' };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <RegionProfile id={id} />;
}
