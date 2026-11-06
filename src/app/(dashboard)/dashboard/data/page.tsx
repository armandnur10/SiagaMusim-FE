import type { Metadata } from 'next';
import { DataPage } from '@/components/dashboard/data/DataPage';

export const metadata: Metadata = { title: 'Data' };

export default function Page() {
  return <DataPage />;
}
