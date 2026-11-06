import type { Metadata } from 'next';
import { WilayahPage } from '@/components/dashboard/wilayah/WilayahPage';

export const metadata: Metadata = { title: 'Wilayah' };

export default function Page() {
  return <WilayahPage />;
}
