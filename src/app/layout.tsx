import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';
import './tokens.css';
import './globals.css';
import { EwsDataProvider } from '@/lib/data/EwsDataProvider';

export const metadata: Metadata = {
  title: {
    default: 'Siaga Musim — Peringatan Dini Penyakit Berbasis Cuaca · Jakarta Timur',
    template: '%s · Siaga Musim',
  },
  description:
    'Prototype sistem peringatan dini (EWS) yang menghubungkan curah hujan dengan potensi lonjakan DBD, muntaber, dan influenza per kelurahan di Jakarta Timur. Seluruh data adalah data simulasi.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a2b30',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="stylesheet" href="/maplibre-gl.css" />
      </head>
      <body>
        <EwsDataProvider>{children}</EwsDataProvider>
      </body>
    </html>
  );
}
