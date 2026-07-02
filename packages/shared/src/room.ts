/**
 * Layout della stanza unica di Barlandia (il "bar").
 *
 * La griglia è isometrica lato rendering ma logicamente è una semplice
 * matrice: x cresce verso destra-giù (sud-est visivo), y verso sinistra-giù
 * (sud-ovest visivo). Il layout è definito QUI, lato server/condiviso:
 * il client non è mai fonte di verità sulla percorribilità.
 *
 * Legenda:
 *   '.' pavimento percorribile
 *   'B' bancone (bloccato, fisso)
 *   'M' macchina espresso sul bancone (bloccato, fisso — solo resa diversa)
 *   'X' zona non percorribile (dietro il bancone / scaffale bottiglie)
 */

export const ROOM_W = 12;
export const ROOM_H = 12;

const LAYOUT: readonly string[] = [
  '..XXXXXXX...', // y=0: zona barista (dietro il bancone)
  '..BBMBBBB...', // y=1: bancone lungo il lato nord, macchina espresso a x=4
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
];

export interface TilePos {
  x: number;
  y: number;
}

/** Punto di spawn: davanti all'ingresso, lato sud. */
export const SPAWN: TilePos = { x: 6, y: 9 };

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function isInBounds(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < ROOM_W && y >= 0 && y < ROOM_H;
}

/** true se la tile è bloccata dal layout fisso (bancone, retro-bancone). */
export function isLayoutBlocked(x: number, y: number): boolean {
  if (!isInBounds(x, y)) return true;
  const c = LAYOUT[y]?.[x] ?? 'X';
  return c !== '.';
}

/** Carattere di layout della tile (per il rendering client). */
export function layoutCharAt(x: number, y: number): string {
  if (!isInBounds(x, y)) return 'X';
  return LAYOUT[y]?.[x] ?? 'X';
}

/**
 * Una tile è percorribile se non è bloccata dal layout e non è occupata
 * da un arredo piazzato (extraBlocked: chiavi `tileKey(x,y)`).
 */
export function isWalkable(x: number, y: number, extraBlocked?: ReadonlySet<string>): boolean {
  if (isLayoutBlocked(x, y)) return false;
  if (extraBlocked?.has(tileKey(x, y))) return false;
  return true;
}

/**
 * BFS 4-direzionale sulla griglia. Ritorna il percorso INCLUSO lo start,
 * o null se la destinazione non è raggiungibile.
 * Usato dal client per animare il movimento (proprio e degli altri) e
 * disponibile al server per validazioni.
 */
export function findPath(
  start: TilePos,
  goal: TilePos,
  extraBlocked?: ReadonlySet<string>,
): TilePos[] | null {
  if (!isWalkable(goal.x, goal.y, extraBlocked)) return null;
  if (!isInBounds(start.x, start.y)) return null;
  if (start.x === goal.x && start.y === goal.y) return [start];

  const prev = new Map<string, string | null>();
  const startKey = tileKey(start.x, start.y);
  prev.set(startKey, null);
  const queue: TilePos[] = [start];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  while (queue.length > 0) {
    const cur = queue.shift() as TilePos;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = tileKey(nx, ny);
      if (prev.has(key)) continue;
      if (!isWalkable(nx, ny, extraBlocked)) continue;
      prev.set(key, tileKey(cur.x, cur.y));
      if (nx === goal.x && ny === goal.y) {
        // ricostruzione percorso
        const path: TilePos[] = [];
        let k: string | null = key;
        while (k !== null) {
          const parts = k.split(',');
          path.push({ x: Number(parts[0]), y: Number(parts[1]) });
          k = prev.get(k) ?? null;
        }
        path.reverse();
        return path;
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

/** Trova una tile libera vicino allo spawn (per il join). */
export function findSpawnTile(occupied: ReadonlySet<string>): TilePos {
  // anelli concentrici attorno allo spawn
  for (let r = 0; r < Math.max(ROOM_W, ROOM_H); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = SPAWN.x + dx;
        const y = SPAWN.y + dy;
        if (isWalkable(x, y) && !occupied.has(tileKey(x, y))) {
          return { x, y };
        }
      }
    }
  }
  return SPAWN; // fallback: stanza piena, ci si sovrappone
}
