/**
 * Anteprima arredi per shop/inventario: renderizza lo STESSO disegno
 * (`drawFurniture`) usato nella stanza, invece di un'emoji scollegata.
 * Garantisce strutturalmente che "quello che vedi nello shop" sia
 * "quello che ottieni piazzato" — niente più mismatch tra le due
 * rappresentazioni (bug osservato: emoji di anteprima che non
 * assomigliava per niente all'arredo reale).
 *
 * Un'unica Application headless, condivisa e serializzata (una render
 * alla volta): il risultato per ogni spriteKey è cacheato, quindi il
 * costo si paga una sola volta per sessione.
 */
import { Application, Graphics, Rectangle } from 'pixi.js';
import { drawFurniture } from './sprites';

let appPromise: Promise<Application> | null = null;
const cache = new Map<string, string>();
// Richieste in volo per spriteKey: essenziale per deduplicare le doppie
// chiamate che React StrictMode genera montando ogni componente due volte
// in sviluppo — senza questa mappa, la seconda chiamata (quella che conta,
// l'unica non "cancelled" lato componente) finiva in coda DIETRO tutte le
// altre 9 richieste invece che risolversi subito insieme alla prima.
const inFlight = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

async function getApp(): Promise<Application> {
  if (!appPromise) {
    appPromise = (async () => {
      const app = new Application();
      await app.init({ width: 4, height: 4, backgroundAlpha: 0 });
      return app;
    })();
  }
  return appPromise;
}

async function renderOne(spriteKey: string): Promise<string> {
  const app = await getApp();
  const g = new Graphics();
  drawFurniture(g, spriteKey);
  const bounds = g.getLocalBounds();
  // margine attorno al disegno così non tocca i bordi dell'anteprima
  const margin = Math.max(bounds.width, bounds.height) * 0.08;
  const frame = new Rectangle(
    bounds.x - margin,
    bounds.y - margin,
    bounds.width + margin * 2,
    bounds.height + margin * 2,
  );

  const url = await app.renderer.extract.base64({ target: g, frame, resolution: 2 });
  g.destroy();
  cache.set(spriteKey, url);
  return url;
}

/** Ritorna (cacheata) l'anteprima PNG per uno sprite_key di arredo. */
export function renderFurniturePreview(spriteKey: string): Promise<string> {
  const cached = cache.get(spriteKey);
  if (cached) return Promise.resolve(cached);

  const existing = inFlight.get(spriteKey);
  if (existing) return existing;

  const task = queue.then(() => renderOne(spriteKey));
  queue = task.then(
    () => undefined,
    () => undefined,
  );
  inFlight.set(spriteKey, task);
  task.finally(() => inFlight.delete(spriteKey));
  return task;
}
