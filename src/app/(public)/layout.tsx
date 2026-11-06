import { PublicFooter, PublicHeader } from '@/components/shell';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <PublicHeader />
      <main className="w-full flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
