import { inviteToCompany } from '@barlandia/shared';
import { env, errorJson, json, requireUser } from '@/lib/server';

/** Invita un utente (per username) nella propria compagnia. */
export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: { username?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'bad_request', 'JSON non valido');
  }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  if (!username) return errorJson(400, 'invalid_username', 'Username mancante');

  const result = await inviteToCompany(env().DB, user.id, username);
  if (!result.ok) {
    const messages = {
      not_found: 'Utente non trovato',
      no_company: 'Non fai parte di nessuna compagnia',
      already_member: 'È già in una compagnia',
      already_invited: 'Già invitato',
      full: 'Compagnia al completo (max 25 membri)',
      self: 'Non puoi invitare te stesso',
    } as const;
    return errorJson(400, result.error, messages[result.error]);
  }
  return json({ ok: true });
}
