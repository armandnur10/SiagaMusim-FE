import type { Metadata } from 'next';
import { TrenPage } from '@/components/dashboard/tren/TrenPage';

export const metadata: Metadata = { title: 'Tren & cuaca' };

export default function Page() {
  return <TrenPage />;
}
