/**
 * Sprite procedurali degli arredi (placeholder vettoriali coerenti con la
 * direzione artistica "caffè italiano vintage" — vedi README).
 *
 * Ogni arredo è disegnato dentro una Graphics con origine al CENTRO della
 * tile (0,0) e si sviluppa verso l'alto (y negative). Quando si passerà a
 * un tileset CC0, basterà sostituire queste funzioni con Sprite/texture
 * mantenendo gli stessi sprite_key.
 */
import { Graphics } from 'pixi.js';
import { PALETTE as P } from './palette';
import { TILE_H, TILE_W } from './iso';

/**
 * Prisma isometrico: base a rombo scalata `s` (0..1 della tile), altezza
 * `h` px, opzionalmente sollevato da terra di `lift` px.
 */
function isoPrism(
  g: Graphics,
  s: number,
  h: number,
  colors: { top: number; left: number; right: number },
  lift = 0,
): void {
  const ex = (TILE_W / 2) * s; // semi-larghezza
  const ey = (TILE_H / 2) * s; // semi-profondità
  const y0 = -lift;
  const y1 = -lift - h;
  // faccia sinistra (S->W)
  g.poly([0, ey + y0, -ex, y0, -ex, y1, 0, ey + y1]).fill(colors.left);
  // faccia destra (E->S)
  g.poly([ex, y0, 0, ey + y0, 0, ey + y1, ex, y1]).fill(colors.right);
  // faccia superiore
  g.poly([0, -ey + y1, ex, y1, 0, ey + y1, -ex, y1]).fill(colors.top);
}

function shadow(g: Graphics, s = 0.7, alpha = 0.18): void {
  g.ellipse(0, 2, (TILE_W / 2) * s, (TILE_H / 2) * s).fill({ color: P.shadow, alpha });
}

const WOOD = { top: P.woodTop, left: P.woodDark, right: P.woodFront };

// ---------------------------------------------------------------------------

function sgabello(g: Graphics): void {
  shadow(g, 0.45);
  // gamba centrale + piede
  g.rect(-2, -18, 4, 18).fill(P.woodDark);
  g.ellipse(0, 0, 10, 5).fill(P.woodFront);
  // seduta imbottita terracotta con bordo ottone
  g.ellipse(0, -20, 13, 7).fill(P.terracotta);
  g.ellipse(0, -22, 13, 7).fill(P.terracottaViva);
  g.ellipse(0, -22, 13, 7).stroke({ width: 1.5, color: P.brass });
}

function tavolino(g: Graphics): void {
  shadow(g, 0.75);
  g.rect(-3, -26, 6, 26).fill(P.woodDark);
  isoPrism(g, 0.78, 5, WOOD, 26);
  // tovaglietta crema al centro
  g.poly([0, -34.5, 12, -28.5, 0, -22.5, -12, -28.5]).fill(P.crema);
}

function tavolinoTondo(g: Graphics): void {
  shadow(g, 0.7);
  g.rect(-3, -26, 6, 26).fill(P.metal);
  g.ellipse(0, 0, 9, 4.5).fill(P.metal);
  g.ellipse(0, -28, 20, 10).fill(P.woodDark);
  g.ellipse(0, -30, 20, 10).fill(P.woodTop);
  g.ellipse(0, -30, 20, 10).stroke({ width: 1.5, color: P.brass });
}

function lampada(g: Graphics): void {
  shadow(g, 0.4);
  g.ellipse(0, -1, 8, 4).fill(P.brass);
  g.rect(-1.5, -30, 3, 30).fill(P.brass);
  // alone caldo
  g.circle(0, -36, 14).fill({ color: P.paglierino, alpha: 0.25 });
  // paralume
  g.poly([-10, -30, 10, -30, 6, -42, -6, -42]).fill(P.terracottaViva);
  g.poly([-10, -30, 10, -30, 6, -42, -6, -42]).stroke({ width: 1, color: P.espresso });
}

function insegnaNeon(g: Graphics): void {
  shadow(g, 0.5);
  // supporto
  g.rect(-2, -34, 4, 34).fill(P.espresso);
  // pannello scuro
  g.roundRect(-20, -62, 40, 30, 6).fill(0x241811);
  g.roundRect(-20, -62, 40, 30, 6).stroke({ width: 2, color: P.neonOn, alpha: 0.9 });
  // tazzina al neon: corpo + manico + vapore
  g.roundRect(-9, -49, 14, 9, 3).stroke({ width: 2, color: P.neonOn });
  g.circle(8, -45, 4).stroke({ width: 2, color: P.neonOn });
  g.moveTo(-5, -53).quadraticCurveTo(-2, -57, -5, -60).stroke({ width: 1.5, color: P.paglierino });
  g.moveTo(1, -53).quadraticCurveTo(4, -57, 1, -60).stroke({ width: 1.5, color: P.paglierino });
  // bagliore
  g.roundRect(-22, -64, 44, 34, 8).stroke({ width: 4, color: P.neonOn, alpha: 0.15 });
}

function pianta(g: Graphics): void {
  shadow(g, 0.45);
  // vaso in terracotta
  g.poly([-9, -14, 9, -14, 6, 0, -6, 0]).fill(P.terracotta);
  g.rect(-10, -16, 20, 4).fill(P.terracottaViva);
  // fogliame a ciuffi
  g.circle(-6, -26, 8).fill(P.salvia);
  g.circle(6, -25, 7).fill(P.teal);
  g.circle(0, -33, 9).fill(P.salvia);
  g.circle(2, -24, 6).fill(0x6d8a63);
}

function runner(g: Graphics): void {
  // tessuto piatto sulla tile (non ha volume)
  g.poly([0, -13, 26, 0, 0, 13, -26, 0]).fill(P.terracotta);
  g.poly([0, -10, 20, 0, 0, 10, -20, 0]).stroke({ width: 1.5, color: P.paglierino });
  g.poly([0, -4, 8, 0, 0, 4, -8, 0]).fill(P.paglierino);
}

function jukebox(g: Graphics): void {
  shadow(g, 0.8);
  isoPrism(g, 0.72, 40, { top: P.woodTop, left: P.woodDark, right: P.woodFront });
  // cupola sul davanti (faccia destra = fronte visivo)
  const cx = 8;
  g.moveTo(cx - 8, -40)
    .arc(cx, -40, 9, Math.PI, 0)
    .fill(P.brass);
  // arco al neon sul fronte
  g.moveTo(cx - 6, -18)
    .arc(cx, -18, 7, Math.PI, 0)
    .stroke({ width: 2, color: P.neonOn });
  g.roundRect(cx - 6, -16, 12, 7, 2).fill(P.teal);
  g.roundRect(cx - 5, -34, 10, 12, 2).fill(0x241811);
  g.roundRect(cx - 5, -34, 10, 12, 2).stroke({ width: 1, color: P.brass });
}

function biliardino(g: Graphics): void {
  shadow(g, 0.85);
  // gambe
  g.rect(-18, -18, 4, 18).fill(P.woodDark);
  g.rect(14, -18, 4, 18).fill(P.woodDark);
  // cassa
  isoPrism(g, 0.9, 14, { top: P.salvia, left: P.woodDark, right: P.woodFront }, 16);
  // stecche con omini
  for (const off of [-8, 0, 8]) {
    g.rect(-24, -34 + off / 2, 48, 2).fill(P.metal);
    for (const px of [-12, 0, 12]) {
      g.rect(px - 2 + off, -37 + off / 2, 4, 7).fill(off === 0 ? P.terracotta : P.teal);
    }
  }
}

function freccette(g: Graphics): void {
  shadow(g, 0.4);
  // palo
  g.rect(-2, -44, 4, 44).fill(P.espresso);
  // bersaglio (rivolto in camera)
  g.circle(0, -52, 15).fill(0x241811);
  g.circle(0, -52, 13).fill(P.crema);
  g.circle(0, -52, 10).fill(P.teal);
  g.circle(0, -52, 7).fill(P.crema);
  g.circle(0, -52, 4).fill(P.terracotta);
  g.circle(0, -52, 1.8).fill(P.brass);
  g.circle(0, -52, 15).stroke({ width: 1.5, color: P.brass });
}

// ---------------------------------------------------------------------------
// Decori fissi (non acquistabili): macchina espresso, mensola bottiglie,
// quadro a parete — rompono il vuoto della stanza senza dipendere dallo shop.

export function drawEspressoMachine(g: Graphics): void {
  // corpo in metallo
  g.roundRect(-14, -26, 28, 18, 3).fill(P.metal);
  g.roundRect(-14, -30, 28, 6, 2).fill(0x8c8680);
  // manometro e leve
  g.circle(0, -21, 3.5).fill(P.crema);
  g.circle(0, -21, 3.5).stroke({ width: 1, color: P.espresso });
  g.rect(-9, -14, 3, 6).fill(P.brass);
  g.rect(6, -14, 3, 6).fill(P.brass);
  // tazzine sopra
  g.ellipse(-6, -32, 3, 1.8).fill(P.crema);
  g.ellipse(4, -32, 3, 1.8).fill(P.crema);
}

const BOTTLE_COLORS = [P.terracotta, P.teal, P.salvia, P.vinaccia, P.brass, P.terracottaViva];

/** Mensola con bottiglie, appesa al muro sopra il bancone. */
export function drawBottleShelf(g: Graphics, seed: number): void {
  g.rect(-27, -3, 54, 5).fill(P.woodDark);
  g.rect(-27, -3, 54, 5).stroke({ width: 1, color: P.brass, alpha: 0.6 });
  const xs = [-19, -11, -3, 5, 13, 21];
  xs.forEach((bx, i) => {
    const c = BOTTLE_COLORS[(i + seed) % BOTTLE_COLORS.length]!;
    const h = 13 + ((i + seed) % 3) * 2;
    g.roundRect(bx - 2.2, -3 - h, 4.4, h, 1.5).fill({ color: c, alpha: 0.9 });
    g.rect(bx - 1, -5 - h, 2, 4).fill({ color: c, alpha: 0.9 });
  });
}

/** Quadro/menu a parete: cornice ottone + "lavagna" con voci scritte a mano. */
export function drawWallFrame(g: Graphics): void {
  g.roundRect(-24, -46, 48, 36, 3).fill(P.espresso);
  g.roundRect(-24, -46, 48, 36, 3).stroke({ width: 2, color: P.brass });
  g.roundRect(-20, -42, 40, 28, 2).fill(0x2a1e14);
  for (const [i, w] of [26, 32, 20].entries()) {
    g.rect(-16, -36 + i * 8, w, 2.5).fill({ color: P.crema, alpha: 0.55 });
  }
}

/** Lampada a sospensione centrale: cavo + paralume conico + lampadina accesa. */
export function drawPendantLamp(g: Graphics): void {
  g.rect(-1, -70, 2, 40).fill(P.espresso);
  g.poly([-14, -30, 14, -30, 9, -18, -9, -18]).fill(P.woodDark);
  g.poly([-14, -30, 14, -30, 9, -18, -9, -18]).stroke({ width: 1, color: P.brass, alpha: 0.7 });
  g.ellipse(0, -19, 6, 3).fill({ color: 0xffe6a8, alpha: 0.95 });
}

/**
 * Alone caldo sul pavimento sotto una lampada: cerchi concentrici a bassa
 * opacità (PixiJS Graphics non ha un gradiente radiale comodo per un
 * caso così semplice) — rompe la piattezza dell'illuminazione uniforme
 * della stanza.
 */
export function drawFloorGlow(g: Graphics): void {
  const rings: [number, number][] = [
    [70, 0.05],
    [52, 0.07],
    [36, 0.09],
    [20, 0.12],
  ];
  for (const [r, alpha] of rings) {
    g.ellipse(0, 0, r, r * 0.55).fill({ color: 0xffdd99, alpha });
  }
}

// ---------------------------------------------------------------------------

const DRAWERS: Record<string, (g: Graphics) => void> = {
  sgabello,
  tavolino,
  tavolino_tondo: tavolinoTondo,
  lampada,
  insegna_neon: insegnaNeon,
  pianta,
  runner,
  jukebox,
  biliardino,
  freccette,
};

/** Disegna l'arredo `spriteKey` dentro la Graphics (origine = centro tile). */
export function drawFurniture(g: Graphics, spriteKey: string): void {
  const draw = DRAWERS[spriteKey] ?? sgabello;
  draw(g);
}

/** Emoji di anteprima per shop/inventario (placeholder UI, vedi README). */
export const SPRITE_EMOJI: Record<string, string> = {
  sgabello: '🪑',
  tavolino: '🟫',
  tavolino_tondo: '🍷',
  lampada: '💡',
  insegna_neon: '🪧',
  pianta: '🪴',
  runner: '🧣',
  jukebox: '📻',
  biliardino: '⚽',
  freccette: '🎯',
};
