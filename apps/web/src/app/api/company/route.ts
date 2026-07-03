import { createCompany, getMyCompany, getMyInvites } from '@barlandia/shared';
import { env, errorJson, json, requireUser } from '@/lib/server';

/** Compagnia dell'utente (o null) + inviti pendenti ricevuti. */
export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const db = env().DB;
  const [company, invites] = await Promise.all([getMyCompany(db, user.id), getMyInvites(db, user.id)]);
  return json({ company, invites });
}

/** Fonda una nuova compagnia (nome + stemma). */
export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: { name?: unknown; emblem?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'bad_request', 'JSON non valido');
  }
  const name = typeof body.name === 'string' ? body.name : '';
  const emblem = typeof body.emblem === 'string' ? body.emblem : '';

  const result = await createCompany(env().DB, user.id, name, emblem);
  if (!result.ok) {
    const messages = {
      already_in_company: 'Fai già parte di una compagnia',
      name_taken: 'Nome già preso da un’altra compagnia',
      invalid_emblem: 'Stemma non valido',
      invalid_name: 'Nome tra 3 e 30 caratteri',
    } as const;
    return errorJson(400, result.error, messages[result.error]);
  }
  return json({ company: result.company }, { status: 201 });
}
