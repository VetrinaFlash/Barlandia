/**
 * Compagnie (voce 35 di docs/GAME-DESIGN.md): test diretti su D1, senza
 * WebSocket — le funzioni in companies.ts non toccano il RoomDO.
 */
import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  COMPANY_MAX_MEMBERS,
  createCompany,
  getMyCompany,
  getMyInvites,
  inviteToCompany,
  leaveCompany,
  respondToInvite,
  setCompanyMotto,
} from '@barlandia/shared';

async function makeUser(id: string, username: string): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO users (id, username, email, password_hash) VALUES (?1, ?2, ?3, 'x')`,
  )
    .bind(id, username, `${username}@test.it`)
    .run();
}

describe('Fondazione e appartenenza', () => {
  beforeAll(async () => {
    await makeUser('c-anna', 'annac');
    await makeUser('c-bruno', 'brunoc');
  });

  it('fonda una compagnia: il fondatore ne diventa membro con ruolo fondatore', async () => {
    const result = await createCompany(env.DB, 'c-anna', 'I Nottambuli', '⭐');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.company.name).toBe('I Nottambuli');
    expect(result.company.members).toEqual([{ id: 'c-anna', username: 'annac', role: 'fondatore' }]);

    const mine = await getMyCompany(env.DB, 'c-anna');
    expect(mine?.id).toBe(result.company.id);
  });

  it('non si può fondare una seconda compagnia se già in una', async () => {
    const result = await createCompany(env.DB, 'c-anna', 'Altra Compagnia', '🔥');
    expect(result).toEqual({ ok: false, error: 'already_in_company' });
  });

  it('nome duplicato (case-insensitive) e stemma non valido sono rifiutati', async () => {
    await makeUser('c-carla', 'carlac');
    const dup = await createCompany(env.DB, 'c-carla', 'i nottambuli', '⚓');
    expect(dup).toEqual({ ok: false, error: 'name_taken' });

    await makeUser('c-dino', 'dinoc');
    const badEmblem = await createCompany(env.DB, 'c-dino', 'I Ranocchi', '🐸');
    expect(badEmblem).toEqual({ ok: false, error: 'invalid_emblem' });
  });
});

describe('Inviti', () => {
  beforeAll(async () => {
    await makeUser('c-elena', 'elenac');
    await makeUser('c-fabio', 'fabioc');
    await makeUser('c-giulia', 'giuliac');
    await createCompany(env.DB, 'c-elena', 'Il Circolo', '👑');
  });

  it('invita, elenca tra gli inviti ricevuti, poi accetta ed entra tra i membri', async () => {
    const invite = await inviteToCompany(env.DB, 'c-elena', 'fabioc');
    expect(invite).toEqual({ ok: true });

    const invites = await getMyInvites(env.DB, 'c-fabio');
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({ name: 'Il Circolo', emblem: '👑', invitedBy: 'elenac' });

    const company = await getMyCompany(env.DB, 'c-elena');
    const respond = await respondToInvite(env.DB, 'c-fabio', company!.id, true);
    expect(respond).toEqual({ ok: true, joined: true });

    const updated = await getMyCompany(env.DB, 'c-elena');
    expect(updated?.members.map((m) => m.id)).toEqual(['c-elena', 'c-fabio']);
  });

  it('rifiutare un invito lo rimuove senza farti entrare', async () => {
    await inviteToCompany(env.DB, 'c-elena', 'giuliac');
    const company = await getMyCompany(env.DB, 'c-elena');
    const respond = await respondToInvite(env.DB, 'c-giulia', company!.id, false);
    expect(respond).toEqual({ ok: true, joined: false });
    expect(await getMyCompany(env.DB, 'c-giulia')).toBeNull();
    expect(await getMyInvites(env.DB, 'c-giulia')).toEqual([]);
  });

  it('non si può invitare chi è già in una compagnia, né due volte la stessa persona', async () => {
    const alreadyMember = await inviteToCompany(env.DB, 'c-elena', 'fabioc');
    expect(alreadyMember).toEqual({ ok: false, error: 'already_member' });

    await inviteToCompany(env.DB, 'c-elena', 'giuliac');
    const dupInvite = await inviteToCompany(env.DB, 'c-elena', 'giuliac');
    expect(dupInvite).toEqual({ ok: false, error: 'already_invited' });
  });

  it('chi non ha una compagnia non può invitare nessuno', async () => {
    await makeUser('c-huey', 'hueyc');
    const result = await inviteToCompany(env.DB, 'c-huey', 'giuliac');
    expect(result).toEqual({ ok: false, error: 'no_company' });
  });
});

describe('Uscita e scioglimento', () => {
  beforeAll(async () => {
    await makeUser('c-ines', 'inesc');
    await makeUser('c-luca', 'lucac');
    await createCompany(env.DB, 'c-ines', 'La Compagnia del Bancone', '🍀');
    await inviteToCompany(env.DB, 'c-ines', 'lucac');
    const company = await getMyCompany(env.DB, 'c-ines');
    await respondToInvite(env.DB, 'c-luca', company!.id, true);
  });

  it('il fondatore che se ne va passa il titolo al membro più anziano rimasto', async () => {
    const result = await leaveCompany(env.DB, 'c-ines');
    expect(result).toEqual({ ok: true, disbanded: false });

    const company = await getMyCompany(env.DB, 'c-luca');
    expect(company?.founderId).toBe('c-luca');
    expect(company?.members).toEqual([{ id: 'c-luca', username: 'lucac', role: 'fondatore' }]);
  });

  it("l'ultimo membro che se ne va scioglie la compagnia", async () => {
    const result = await leaveCompany(env.DB, 'c-luca');
    expect(result).toEqual({ ok: true, disbanded: true });
    expect(await getMyCompany(env.DB, 'c-luca')).toBeNull();
  });

  it('chi non è in nessuna compagnia non può uscirne', async () => {
    const result = await leaveCompany(env.DB, 'c-luca');
    expect(result).toEqual({ ok: false, error: 'not_member' });
  });
});

describe('Limite membri e motto', () => {
  it(`rifiuta il ${COMPANY_MAX_MEMBERS + 1}° membro (limite ${COMPANY_MAX_MEMBERS})`, async () => {
    await makeUser('c-founder', 'founderc');
    await createCompany(env.DB, 'c-founder', 'Grande Compagnia', '🛡️');
    const company = await getMyCompany(env.DB, 'c-founder');

    for (let i = 0; i < COMPANY_MAX_MEMBERS - 1; i++) {
      const uid = `c-member-${i}`;
      await makeUser(uid, `memberc${i}`);
      await inviteToCompany(env.DB, 'c-founder', `memberc${i}`);
      await respondToInvite(env.DB, uid, company!.id, true);
    }
    // ora la compagnia ha COMPANY_MAX_MEMBERS membri (fondatore + N-1)
    const full = await getMyCompany(env.DB, 'c-founder');
    expect(full?.members).toHaveLength(COMPANY_MAX_MEMBERS);

    await makeUser('c-overflow', 'overflowc');
    const invite = await inviteToCompany(env.DB, 'c-founder', 'overflowc');
    expect(invite).toEqual({ ok: false, error: 'full' });
  });

  it('solo il fondatore può cambiare il motto', async () => {
    await makeUser('c-motto-founder', 'mottofounder');
    await makeUser('c-motto-member', 'mottomember');
    await createCompany(env.DB, 'c-motto-founder', 'Motto Test', '⚓');
    const company = await getMyCompany(env.DB, 'c-motto-founder');
    await inviteToCompany(env.DB, 'c-motto-founder', 'mottomember');
    await respondToInvite(env.DB, 'c-motto-member', company!.id, true);

    const asFounder = await setCompanyMotto(env.DB, 'c-motto-founder', 'Sempre al bancone!');
    expect(asFounder).toBe(true);

    const asMember = await setCompanyMotto(env.DB, 'c-motto-member', 'Provo a barare');
    expect(asMember).toBe(false);

    const final = await getMyCompany(env.DB, 'c-motto-founder');
    expect(final?.motto).toBe('Sempre al bancone!');
  });
});
