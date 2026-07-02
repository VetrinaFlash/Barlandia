/** Proiezione isometrica 2:1 (tile 64x32). */

export const TILE_W = 64;
export const TILE_H = 32;

/** Centro della tile (x,y) in coordinate mondo. */
export function tileToWorld(x: number, y: number): { x: number; y: number } {
  return {
    x: ((x - y) * TILE_W) / 2,
    y: ((x + y) * TILE_H) / 2,
  };
}

/**
 * Coordinate mondo → tile. Il rounding in spazio isometrico equivale a un
 * hit-test esatto sul rombo della tile.
 */
export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  const fx = wx / (TILE_W / 2);
  const fy = wy / (TILE_H / 2);
  return {
    x: Math.round((fy + fx) / 2),
    y: Math.round((fy - fx) / 2),
  };
}

/** Ordine di disegno (painter's algorithm) per una posizione tile (anche frazionaria). */
export function depthOf(x: number, y: number): number {
  return x + y;
}
