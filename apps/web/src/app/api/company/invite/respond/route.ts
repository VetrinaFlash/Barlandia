import { respondToInvite } from '@barlandia/shared';
import { env, errorJson, json, requireUser } from '@/lib/server';

/** Accetta o rifiuta un invito ricevuto. */
export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: { companyId?: unknown; accept?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'bad_request', 'JSON non valido');
  }
  const companyId = typeof body.companyId === 'string' ? body.companyId : '';
  const accept = body.accept === true;
  if (!companyId) return errorJson(400, 'bad_request', 'companyId mancante');

  const result = await respondToInvite(env().DB, user.id, companyId, accept);
  if (!result.ok) {
    const messages = {
      not_found: 'Invito non trovato',
      already_in_company: 'Fai già parte di una compagnia',
      full: 'Compagnia al completo (max 25 membri)',
    } as const;
    return errorJson(400, result.error, messages[result.error]);
  }
  return json({ ok: true, joined: result.joined });
}
