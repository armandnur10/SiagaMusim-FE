import type { Metadata } from 'next';
import { DashboardShell } from '@/components/shell';
import { DashboardFiltersProvider } from '@/lib/state/filters';

export const metadata: Metadata = {
  title: { default: 'Dasbor pemantauan', template: '%s · Dasbor Siaga Musim' },
  description: 'Dasbor peringatan dini penyakit berbasis cuaca untuk pengambil kebijakan di Jakarta Timur.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardFiltersProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardFiltersProvider>
  );
}
