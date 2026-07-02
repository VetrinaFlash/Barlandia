'use client';

import { useEffect } from 'react';

/** Registra il service worker minimale per l'installabilità PWA. */
export function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // niente offline: la registrazione fallita non è bloccante
      });
    }
  }, []);
  return null;
}
