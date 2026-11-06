import type { Metadata } from 'next';
import { RingkasanPage } from '@/components/dashboard/ringkasan/RingkasanPage';

export const metadata: Metadata = { title: 'Ringkasan' };

export default function Page() {
  return <RingkasanPage />;
}
