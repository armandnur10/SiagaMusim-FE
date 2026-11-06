import type { Config } from 'tailwindcss';

// Semua warna mengacu ke token CSS di src/app/tokens.css (satu sumber kebenaran).
// Warna level peringatan & penyakit TIDAK ada di sini: ambil dari src/lib/config.ts
// (LEVELS / DISEASES) dan pasang lewat `style`, karena nilainya ditentukan data.
const config: Config = {
  content: ['./src/components/**/*.{ts,tsx}', './src/app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        sunken: 'var(--sunken)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        brand: {
          DEFAULT: 'var(--brand)',
          strong: 'var(--brand-strong)',
          soft: 'var(--brand-soft)',
          deep: 'var(--brand-deep)',
        },
        rain: {
          DEFAULT: 'var(--rain)',
          soft: 'var(--rain-soft)',
          text: 'var(--rain-text)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
    },
  },
  plugins: [],
};

export default config;
