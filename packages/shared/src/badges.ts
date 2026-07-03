/**
 * Badge — assegnazione idempotente, nessuna valuta coinvolta.
 * Vedi migrations/0004_friends_badges.sql per il catalogo.
 */

/// <reference types="@cloudflare/workers-types" />

export interface BadgeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/**
 * Assegna un badge se non già posseduto. Ritorna il badge (con i suoi
 * dati) se è stato assegnato ORA, o null se l'utente lo aveva già
 * (idempotente: sicuro da chiamare ad ogni occasione che lo scatena,
 * non solo la prima volta).
 */
export async function awardBadge(
  db: D1Database,
  userId: string,
  badgeId: string,
): Promise<BadgeInfo | null> {
  const claim = await db
    .prepare(`INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?1, ?2)`)
    .bind(userId, badgeId)
    .run();
  if ((claim.meta.changes ?? 0) === 0) return null;
  return db
    .prepare(`SELECT id, name, description, icon FROM badges WHERE id = ?1`)
    .bind(badgeId)
    .first<BadgeInfo>();
}

export interface UserBadge extends BadgeInfo {
  earnedAt: number;
}

export async function listUserBadges(db: D1Database, userId: string): Promise<UserBadge[]> {
  const rows = await db
    .prepare(
      `SELECT b.id, b.name, b.description, b.icon, ub.earned_at AS earnedAt
       FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = ?1
       ORDER BY ub.earned_at ASC`,
    )
    .bind(userId)
    .all<UserBadge>();
  return rows.results;
}

export async function listAllBadges(db: D1Database): Promise<BadgeInfo[]> {
  const rows = await db
    .prepare(`SELECT id, name, description, icon FROM badges ORDER BY rowid ASC`)
    .all<BadgeInfo>();
  return rows.results;
}

/** Badge guadagnati oggi (UTC) — per la cartolina della serata. */
export async function listBadgesEarnedToday(db: D1Database, userId: string): Promise<BadgeInfo[]> {
  const rows = await db
    .prepare(
      `SELECT b.id, b.name, b.description, b.icon
       FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = ?1 AND date(ub.earned_at, 'unixepoch') = date('now')
       ORDER BY ub.earned_at ASC`,
    )
    .bind(userId)
    .all<BadgeInfo>();
  return rows.results;
}
