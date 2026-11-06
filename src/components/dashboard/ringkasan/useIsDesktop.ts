'use client';

import { useSyncExternalStore } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * true pada layar ≥ lg (1024px). Dipakai untuk menjadikan peta pratinjau statis di ponsel
 * dan menyesuaikan kata petunjuk ("klik" / "ketuk"). Hanya dipakai di bawah <DataGate>,
 * jadi tidak ikut dirender di server.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
