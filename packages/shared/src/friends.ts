/**
 * Amicizie — lista, richiesta, accetta, rimuovi. NIENTE valuta qui:
 * "offrigli un caffè" è un trasferimento P2P e resta esplicitamente
 * fuori scope insieme al resto del trading, fino alla fase di audit
 * dedicata (vedi README).
 *
 * Le righe sono ordinate canonicamente (user_a < user_b): una sola
 * riga per coppia, mai due speculari.
 */

/// <reference types="@cloudflare/workers-types" />

function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export interface FriendRow {
  id: string;
  username: string;
  colorScheme: string;
}

export interface FriendsList {
  friends: FriendRow[];
  incoming: FriendRow[]; // richieste ricevute, in attesa di una tua risposta
  outgoing: FriendRow[]; // richieste che hai inviato tu, in attesa
}

export async function getFriendsList(db: D1Database, userId: string): Promise<FriendsList> {
  const rows = await db
    .prepare(
      `SELECT
         CASE WHEN f.user_a = ?1 THEN f.user_b ELSE f.user_a END AS otherId,
         f.status, f.requested_by,
         u.username, COALESCE(a.color_scheme, 'terracotta') AS colorScheme
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_a = ?1 THEN f.user_b ELSE f.user_a END
       LEFT JOIN avatar_config a ON a.user_id = u.id
       WHERE f.user_a = ?1 OR f.user_b = ?1`,
    )
    .bind(userId)
    .all<{ otherId: string; status: string; requested_by: string; username: string; colorScheme: string }>();

  const friends: FriendRow[] = [];
  const incoming: FriendRow[] = [];
  const outgoing: FriendRow[] = [];
  for (const r of rows.results) {
    const row: FriendRow = { id: r.otherId, username: r.username, colorScheme: r.colorScheme };
    if (r.status === 'accepted') friends.push(row);
    else if (r.requested_by === userId) outgoing.push(row);
    else incoming.push(row);
  }
  return { friends, incoming, outgoing };
}

export type FriendRequestResult =
  | { ok: true; alreadyFriends: boolean }
  | { ok: false; error: 'not_found' | 'self' };

/** Invia una richiesta di amicizia (o la considera già soddisfatta se esiste). */
export async function requestFriend(
  db: D1Database,
  userId: string,
  targetUsername: string,
): Promise<FriendRequestResult> {
  const target = await db
    .prepare(`SELECT id FROM users WHERE username = ?1 COLLATE NOCASE`)
    .bind(targetUsername)
    .first<{ id: string }>();
  if (!target) return { ok: false, error: 'not_found' };
  if (target.id === userId) return { ok: false, error: 'self' };

  const [a, b] = pairKey(userId, target.id);
  const existing = await db
    .prepare(`SELECT status FROM friendships WHERE user_a = ?1 AND user_b = ?2`)
    .bind(a, b)
    .first<{ status: string }>();
  if (existing) {
    return { ok: true, alreadyFriends: existing.status === 'accepted' };
  }
  await db
    .prepare(
      `INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES (?1, ?2, 'pending', ?3)`,
    )
    .bind(a, b, userId)
    .run();
  return { ok: true, alreadyFriends: false };
}

/** Accetta una richiesta ricevuta. Fallisce se non esiste o l'hai mandata tu stesso. */
export async function acceptFriend(
  db: D1Database,
  userId: string,
  otherId: string,
): Promise<boolean> {
  const [a, b] = pairKey(userId, otherId);
  const row = await db
    .prepare(
      `UPDATE friendships SET status = 'accepted'
       WHERE user_a = ?1 AND user_b = ?2 AND status = 'pending' AND requested_by != ?3`,
    )
    .bind(a, b, userId)
    .run();
  return (row.meta.changes ?? 0) > 0;
}

/** Rimuove un'amicizia (accettata) o rifiuta/annulla una richiesta pendente. */
export async function removeFriend(db: D1Database, userId: string, otherId: string): Promise<boolean> {
  const [a, b] = pairKey(userId, otherId);
  const row = await db
    .prepare(`DELETE FROM friendships WHERE user_a = ?1 AND user_b = ?2`)
    .bind(a, b)
    .run();
  return (row.meta.changes ?? 0) > 0;
}
