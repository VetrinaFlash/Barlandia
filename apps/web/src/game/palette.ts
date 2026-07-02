/**
 * Palette "caffè italiano vintage" — direzione artistica di Barlandia.
 * Vedi README per il razionale. Cambiare qui = ricolorare tutto il locale.
 */

export const PALETTE = {
  // pavimento a scacchi crema/sabbia
  floorLight: 0xefe3ce,
  floorDark: 0xe0cfb2,
  floorEdge: 0xc9b896,
  floorHighlight: 0xf7eee0,

  // muri
  wallTop: 0xf2e8d5,
  wallLeft: 0xd9c8ab,
  wainscot: 0x7a5c3f,
  wallLine: 0xb59f7d,

  // legno del bancone
  woodTop: 0x8b5e34,
  woodFront: 0x6e4b2a,
  woodDark: 0x54371d,
  brass: 0xc9a227,

  // accenti
  terracotta: 0xc65f3d,
  terracottaViva: 0xe07a54,
  salvia: 0x87a07c,
  teal: 0x3f7a6e,
  vinaccia: 0x8e4a5b,
  espresso: 0x3e2c1e,
  crema: 0xf2e8d5,

  // varie
  shadow: 0x2b1d12,
  metal: 0xa8a29a,
  neonOn: 0xff7a59,
  paglierino: 0xe8d48b,
} as const;

/** Colore principale dell'avatar per ogni color_scheme. */
export const AVATAR_COLORS: Record<string, { body: number; accent: number }> = {
  terracotta: { body: 0xc65f3d, accent: 0x8e3b22 },
  ottone: { body: 0xc9a227, accent: 0x8f7119 },
  salvia: { body: 0x87a07c, accent: 0x5c7354 },
  espresso: { body: 0x5b4232, accent: 0x3e2c1e },
  cielo: { body: 0x5e8fb0, accent: 0x3d647f },
  vinaccia: { body: 0x8e4a5b, accent: 0x63313e },
};

export const SKIN_TONES = [0xf0c8a0, 0xe0ac69, 0xc68642, 0x8d5524];
