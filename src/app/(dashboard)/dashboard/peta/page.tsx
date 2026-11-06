import type { Metadata } from 'next';
import { PetaPage } from '@/components/dashboard/peta/PetaPage';

export const metadata: Metadata = { title: 'Peta risiko' };

export default function Page() {
  return <PetaPage />;
}
