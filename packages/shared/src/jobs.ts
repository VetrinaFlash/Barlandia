/**
 * Postazioni di lavoro (voce 36 di docs/GAME-DESIGN.md, "Turno da
 * barista"): tile FISSE della stanza (non arredi acquistabili) dove un
 * utente può "timbrare" per guadagnare Chicchi a un ritmo maggiore della
 * presenza passiva. Nessuno scambio tra utenti: è solo uno stato di
 * presenza con una paga diversa, stessa categoria di meccanica di
 * "sedersi", non un minigioco (nessun input attivo richiesto).
 */
import type { TilePos } from './room';

export interface JobSpot {
  id: string;
  x: number;
  y: number;
}

/** Un'unica postazione per ora: il bancone dell'espresso. */
export const JOB_SPOTS: readonly JobSpot[] = [{ id: 'bancone', x: 4, y: 2 }];

export function jobSpotAt(pos: TilePos): JobSpot | null {
  return JOB_SPOTS.find((j) => j.x === pos.x && j.y === pos.y) ?? null;
}

export function jobSpotById(id: string): JobSpot | null {
  return JOB_SPOTS.find((j) => j.id === id) ?? null;
}
