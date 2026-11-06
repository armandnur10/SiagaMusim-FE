import type { Metadata } from 'next';
import {
  CityStatus,
  Hero,
  LandingSelectionProvider,
  LevelGuide,
  OfficialsBand,
  RainExplainer,
  RiskMapSection,
} from '@/components/public/landing';
import { DummyDataNote } from '@/components/ui';

export const metadata: Metadata = {
  title: { absolute: 'Siaga Musim · Pantau risiko penyakit musim hujan di Jakarta Timur' },
  description:
    'Cek status mingguan DBD, muntaber, dan influenza di kelurahan Anda di Jakarta Timur, lengkap dengan saran tindakan untuk warga. Prototype dengan data simulasi.',
};

export default function HomePage() {
  return (
    <LandingSelectionProvider>
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-8 sm:px-6 sm:pt-12 lg:pt-16">
        <Hero />
        <DummyDataNote className="mt-8 lg:mt-10" />
        <div className="mt-14 flex flex-col gap-16 lg:mt-20 lg:gap-20">
          <CityStatus />
          <RiskMapSection />
          <RainExplainer />
          <LevelGuide />
          <OfficialsBand />
        </div>
      </div>
    </LandingSelectionProvider>
  );
}
