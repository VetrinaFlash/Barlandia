/**
 * Compagnie (voce 35 di docs/GAME-DESIGN.md): gruppi ufficiali con nome,
 * stemma, motto ed elenco membri. Un utente appartiene al più a una
 * compagnia alla volta (UNIQUE su company_members.user_id). NIENTE
 * valuta condivisa o trasferimenti: è un raggruppamento sociale, non
 * un'entità economica — stessa linea già tracciata per amici/badge
 * (vedi friends.ts).
 *
 * Semplificazioni dichiarate rispetto alla voce 35 originale:
 *  - il "rito fondativo in tre persone al bancone" non è implementato
 *    (richiederebbe un protocollo di coordinamento multi-utente in
 *    tempo reale) — per ora ci si fonda da soli e si invitano gli altri;
 *  - il "tavolo abituale prenotabile" dipende da un sistema di stanze
 *    private che non esiste ancora (vedi roadmap, "seconda area del locale");
 *  - lo stemma non è mostrato sopra l'avatar in stanza (come il livello):
 *    per ora la compagnia si vede solo nella sheet dedicata.
 */

/// <reference types="@cloudflare/workers-types" />

export const COMPANY_EMBLEMS = ['⭐', '⚓', '👑', '🛡️', '🔥', '🍀'] as const;
export type CompanyEmblem = (typeof COMPANY_EMBLEMS)[number];

export const COMPANY_MAX_MEMBERS = 25;
export const COMPANY_NAME_MAX = 30;
export const COMPANY_MOTTO_MAX = 140;

export interface CompanyMember {
  id: string;
  username: string;
  role: 'fondatore' | 'membro';
}

export interface CompanyInvite {
  id: string; // company id
  name: string;
  emblem: string;
  invitedBy: string; // username di chi ha invitato
}

export interface CompanyView {
  id: string;
  name: string;
  emblem: string;
  motto: string;
  founderId: string;
  members: CompanyMember[];
}

export async function getCompanyById(db: D1Database, companyId: string): Promise<CompanyView | null> {
  const company = await db
    .prepare(`SELECT id, name, emblem, motto, founder_id FROM companies WHERE id = ?1`)
    .bind(companyId)
    .first<{ id: string; name: string; emblem: string; motto: string; founder_id: string }>();
  if (!company) return null;
  const members = await db
    .prepare(
      `SELECT m.user_id AS id, u.username, m.role
       FROM company_members m JOIN users u ON u.id = m.user_id
       WHERE m.company_id = ?1
       ORDER BY m.joined_at ASC`,
    )
    .bind(companyId)
    .all<{ id: string; username: string; role: string }>();
  return {
    id: company.id,
    name: company.name,
    emblem: company.emblem,
    motto: company.motto,
    founderId: company.founder_id,
    members: members.results.map((m) => ({
      id: m.id,
      username: m.username,
      role: m.role === 'fondatore' ? 'fondatore' : 'membro',
    })),
  };
}

export async function getMyCompany(db: D1Database, userId: string): Promise<CompanyView | null> {
  const membership = await db
    .prepare(`SELECT company_id FROM company_members WHERE user_id = ?1`)
    .bind(userId)
    .first<{ company_id: string }>();
  if (!membership) return null;
  return getCompanyById(db, membership.company_id);
}

export async function getMyInvites(db: D1Database, userId: string): Promise<CompanyInvite[]> {
  const rows = await db
    .prepare(
      `SELECT c.id AS id, c.name AS name, c.emblem AS emblem, u.username AS invitedBy
       FROM company_invites i
       JOIN companies c ON c.id = i.company_id
       JOIN users u ON u.id = i.invited_by
       WHERE i.user_id = ?1`,
    )
    .bind(userId)
    .all<CompanyInvite>();
  return rows.results;
}

export type CreateCompanyResult =
  | { ok: true; company: CompanyView }
  | { ok: false; error: 'already_in_company' | 'name_taken' | 'invalid_emblem' | 'invalid_name' };

export async function createCompany(
  db: D1Database,
  userId: string,
  name: string,
  emblem: string,
): Promise<CreateCompanyResult> {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > COMPANY_NAME_MAX) {
    return { ok: false, error: 'invalid_name' };
  }
  if (!COMPANY_EMBLEMS.includes(emblem as CompanyEmblem)) {
    return { ok: false, error: 'invalid_emblem' };
  }
  const existing = await db
    .prepare(`SELECT 1 FROM company_members WHERE user_id = ?1`)
    .bind(userId)
    .first();
  if (existing) return { ok: false, error: 'already_in_company' };

  const nameTaken = await db
    .prepare(`SELECT 1 FROM companies WHERE name = ?1 COLLATE NOCASE`)
    .bind(trimmed)
    .first();
  if (nameTaken) return { ok: false, error: 'name_taken' };

  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(`INSERT INTO companies (id, name, emblem, founder_id) VALUES (?1, ?2, ?3, ?4)`)
      .bind(id, trimmed, emblem, userId),
    db
      .prepare(`INSERT INTO company_members (company_id, user_id, role) VALUES (?1, ?2, 'fondatore')`)
      .bind(id, userId),
  ]);
  const company = await getCompanyById(db, id);
  return { ok: true, company: company! };
}

export type InviteResult =
  | { ok: true }
  | {
      ok: false;
      error: 'not_found' | 'no_company' | 'already_member' | 'already_invited' | 'full' | 'self';
    };

export async function inviteToCompany(
  db: D1Database,
  inviterId: string,
  targetUsername: string,
): Promise<InviteResult> {
  const membership = await db
    .prepare(`SELECT company_id FROM company_members WHERE user_id = ?1`)
    .bind(inviterId)
    .first<{ company_id: string }>();
  if (!membership) return { ok: false, error: 'no_company' };

  const target = await db
    .prepare(`SELECT id FROM users WHERE username = ?1 COLLATE NOCASE`)
    .bind(targetUsername)
    .first<{ id: string }>();
  if (!target) return { ok: false, error: 'not_found' };
  if (target.id === inviterId) return { ok: false, error: 'self' };

  const alreadyMember = await db
    .prepare(`SELECT 1 FROM company_members WHERE user_id = ?1`)
    .bind(target.id)
    .first();
  if (alreadyMember) return { ok: false, error: 'already_member' };

  const alreadyInvited = await db
    .prepare(`SELECT 1 FROM company_invites WHERE company_id = ?1 AND user_id = ?2`)
    .bind(membership.company_id, target.id)
    .first();
  if (alreadyInvited) return { ok: false, error: 'already_invited' };

  const count = await db
    .prepare(`SELECT COUNT(*) AS n FROM company_members WHERE company_id = ?1`)
    .bind(membership.company_id)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= COMPANY_MAX_MEMBERS) return { ok: false, error: 'full' };

  await db
    .prepare(`INSERT INTO company_invites (company_id, user_id, invited_by) VALUES (?1, ?2, ?3)`)
    .bind(membership.company_id, target.id, inviterId)
    .run();
  return { ok: true };
}

export type RespondResult =
  | { ok: true; joined: boolean }
  | { ok: false; error: 'not_found' | 'already_in_company' | 'full' };

export async function respondToInvite(
  db: D1Database,
  userId: string,
  companyId: string,
  accept: boolean,
): Promise<RespondResult> {
  const invite = await db
    .prepare(`SELECT 1 FROM company_invites WHERE company_id = ?1 AND user_id = ?2`)
    .bind(companyId, userId)
    .first();
  if (!invite) return { ok: false, error: 'not_found' };

  if (!accept) {
    await db
      .prepare(`DELETE FROM company_invites WHERE company_id = ?1 AND user_id = ?2`)
      .bind(companyId, userId)
      .run();
    return { ok: true, joined: false };
  }

  const alreadyMember = await db
    .prepare(`SELECT 1 FROM company_members WHERE user_id = ?1`)
    .bind(userId)
    .first();
  if (alreadyMember) {
    await db
      .prepare(`DELETE FROM company_invites WHERE company_id = ?1 AND user_id = ?2`)
      .bind(companyId, userId)
      .run();
    return { ok: false, error: 'already_in_company' };
  }

  const count = await db
    .prepare(`SELECT COUNT(*) AS n FROM company_members WHERE company_id = ?1`)
    .bind(companyId)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= COMPANY_MAX_MEMBERS) {
    return { ok: false, error: 'full' };
  }

  await db.batch([
    db
      .prepare(`INSERT INTO company_members (company_id, user_id, role) VALUES (?1, ?2, 'membro')`)
      .bind(companyId, userId),
    db
      .prepare(`DELETE FROM company_invites WHERE company_id = ?1 AND user_id = ?2`)
      .bind(companyId, userId),
    // altri inviti pendenti verso altre compagnie non sono più accettabili
    db.prepare(`DELETE FROM company_invites WHERE user_id = ?1 AND company_id != ?2`).bind(userId, companyId),
  ]);
  return { ok: true, joined: true };
}

export type LeaveResult = { ok: true; disbanded: boolean } | { ok: false; error: 'not_member' };

/**
 * Il fondatore che se ne va passa il titolo al membro più anziano
 * rimasto; se era l'ultimo, la compagnia si scioglie.
 */
export async function leaveCompany(db: D1Database, userId: string): Promise<LeaveResult> {
  const membership = await db
    .prepare(`SELECT company_id, role FROM company_members WHERE user_id = ?1`)
    .bind(userId)
    .first<{ company_id: string; role: string }>();
  if (!membership) return { ok: false, error: 'not_member' };

  await db.prepare(`DELETE FROM company_members WHERE user_id = ?1`).bind(userId).run();

  if (membership.role !== 'fondatore') {
    return { ok: true, disbanded: false };
  }

  const next = await db
    .prepare(`SELECT user_id FROM company_members WHERE company_id = ?1 ORDER BY joined_at ASC LIMIT 1`)
    .bind(membership.company_id)
    .first<{ user_id: string }>();
  if (next) {
    await db.batch([
      db
        .prepare(`UPDATE company_members SET role = 'fondatore' WHERE company_id = ?1 AND user_id = ?2`)
        .bind(membership.company_id, next.user_id),
      db.prepare(`UPDATE companies SET founder_id = ?1 WHERE id = ?2`).bind(next.user_id, membership.company_id),
    ]);
    return { ok: true, disbanded: false };
  }

  await db.batch([
    db.prepare(`DELETE FROM company_invites WHERE company_id = ?1`).bind(membership.company_id),
    db.prepare(`DELETE FROM companies WHERE id = ?1`).bind(membership.company_id),
  ]);
  return { ok: true, disbanded: true };
}

/** Solo il fondatore può cambiare il motto. Ritorna false se il chiamante non lo è. */
export async function setCompanyMotto(db: D1Database, userId: string, motto: string): Promise<boolean> {
  const trimmed = motto.slice(0, COMPANY_MOTTO_MAX);
  const row = await db
    .prepare(`UPDATE companies SET motto = ?1 WHERE founder_id = ?2`)
    .bind(trimmed, userId)
    .run();
  return (row.meta.changes ?? 0) > 0;
}
