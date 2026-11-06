import { ChartLine, Database, LayoutDashboard, Map, Table2, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  /** Label ringkas untuk navigasi bawah (ponsel). */
  short: string;
  icon: LucideIcon;
  /** Cocokkan persis (untuk /dashboard) atau awalan. */
  exact?: boolean;
}

export const DASHBOARD_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Ringkasan', short: 'Ringkasan', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/peta', label: 'Peta risiko', short: 'Peta', icon: Map },
  { href: '/dashboard/tren', label: 'Tren & cuaca', short: 'Tren', icon: ChartLine },
  { href: '/dashboard/wilayah', label: 'Wilayah', short: 'Wilayah', icon: Table2 },
  { href: '/dashboard/data', label: 'Data', short: 'Data', icon: Database },
];

export const isActive = (pathname: string, item: NavItem): boolean =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
