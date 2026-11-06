'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Mengukur lebar konten sebuah elemen (px, dibulatkan) dengan ResizeObserver.
 * Bernilai 0 sampai elemen terpasang - grafik menampilkan placeholder dulu agar tidak
 * terjadi hydration mismatch.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number) => {
      const next = Math.max(0, Math.round(w));
      setWidth((prev) => (prev === next ? prev : next));
    };
    apply(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) apply(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

/**
 * Menutup tooltip saat pengguna menekan di luar grafik (penting untuk layar sentuh,
 * yang tidak punya peristiwa "mouse leave").
 */
export function useOutsideDismiss(ref: RefObject<HTMLElement | null>, enabled: boolean, onDismiss: () => void): void {
  const cb = useRef(onDismiss);
  useEffect(() => {
    cb.current = onDismiss;
  });
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: PointerEvent) => {
      const el = ref.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) cb.current();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [enabled, ref]);
}
