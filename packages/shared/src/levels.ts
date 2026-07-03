/**
 * Livelli "Habitué" (voce 23 di docs/GAME-DESIGN.md): XP SOLO da presenza
 * attiva e da eventi (tris del giorno, badge) — MAI dalla spesa, così un
 * livello racconta "quanto sei stato al bar", non "quanto hai speso".
 * Cap giornaliero (`XP.dailyCap`) per non premiare chi resta collegato
 * H24 rispetto a chi si presenta ogni sera per un'oretta.
 *
 * `awardXp` fa un breve read-then-write (leggere il residuo di oggi e lo
 * xp corrente, poi scrivere in batch): non è atomico al 100% come
 * `creditCurrency`, ma qui non c'è valuta in gioco — nel peggiore dei casi
 * una corsa tra due tick ravvicinati fa guadagnare qualche XP di troppo
 * in un sistema puramente cosmetico, lo stesso compromesso già accettato
 * per il badge `primi_100` (vedi badges.ts).
 */

/// <reference types="@cloudflare/workers-types" />

import { todayUTC } from './currency';

export const XP = {
  presenceTick: 4, // stesso tick del guadagno passivo Chicchi
  trisComplete: 20,
  badgeEarned: 15,
  dailyCap: 120,
} as const;

export interface LevelInfo {
  level: number;
  title: string;
  /** XP maturata a partire dalla soglia del livello corrente. */
  xpIntoLevel: number;
  /** XP necessaria per salire di livello a partire dalla soglia corrente; 0 = livello massimo. */
  xpForNextLevel: number;
}

const LEVELS: { threshold: number; title: string }[] = [
  { threshold: 0, title: 'Nuovo Avventore' },
  { threshold: 80, title: 'Habitué' },
  { threshold: 200, title: 'Amico del Bancone' },
  { threshold: 400, title: 'Volto Noto' },
  { threshold: 700, title: 'Cliente d’Onore' },
  { threshold: 1100, title: 'Colonna del Bar' },
  { threshold: 1600, title: 'Leggenda di Barlandia' },
];

export function levelForXp(xp: number): LevelInfo {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i]!.threshold) idx = i;
    else break;
  }
  const current = LEVELS[idx]!;
  const next = LEVELS[idx + 1];
  return {
    level: idx + 1,
    title: current.title,
    xpIntoLevel: xp - current.threshold,
    xpForNextLevel: next ? next.threshold - current.threshold : 0,
  };
}

export interface XpGainResult {
  gained: number;
  totalXp: number;
  levelBefore: LevelInfo;
  levelAfter: LevelInfo;
}

/**
 * Accredita `amount` XP (> 0) rispettando il cap giornaliero. Ritorna
 * null se il cap di oggi è già saturo (nessuna scrittura in quel caso).
 */
export async function awardXp(
  db: D1Database,
  userId: string,
  amount: number,
): Promise<XpGainResult | null> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`awardXp: amount non valido (${amount})`);
  }
  const today = todayUTC();
  const gainRow = await db
    .prepare(`SELECT amount FROM daily_xp_gains WHERE user_id = ?1 AND gain_date = ?2`)
    .bind(userId, today)
    .first<{ amount: number }>();
  const gainedSoFar = gainRow?.amount ?? 0;
  const room = Math.max(0, XP.dailyCap - gainedSoFar);
  const delta = Math.min(amount, room);
  if (delta <= 0) return null;

  const xpRow = await db
    .prepare(`SELECT xp FROM user_xp WHERE user_id = ?1`)
    .bind(userId)
    .first<{ xp: number }>();
  const xpBefore = xpRow?.xp ?? 0;
  const totalXp = xpBefore + delta;

  await db.batch([
    db
      .prepare(
        `INSERT INTO daily_xp_gains (user_id, gain_date, amount) VALUES (?1, ?2, ?3)
         ON CONFLICT(user_id, gain_date) DO UPDATE SET amount = amount + ?3`,
      )
      .bind(userId, today, delta),
    db
      .prepare(
        `INSERT INTO user_xp (user_id, xp, updated_at) VALUES (?1, ?2, unixepoch())
         ON CONFLICT(user_id) DO UPDATE SET xp = xp + ?2, updated_at = unixepoch()`,
      )
      .bind(userId, delta),
  ]);

  return {
    gained: delta,
    totalXp,
    levelBefore: levelForXp(xpBefore),
    levelAfter: levelForXp(totalXp),
  };
}

export async function getXpState(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT xp FROM user_xp WHERE user_id = ?1`)
    .bind(userId)
    .first<{ xp: number }>();
  return row?.xp ?? 0;
}
