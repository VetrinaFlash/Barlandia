import { getFriendsList, requestFriend } from '@barlandia/shared';
import { env, errorJson, json, requireUser } from '@/lib/server';

export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const list = await getFriendsList(env().DB, user.id);
  return json(list);
}

/** Invia una richiesta di amicizia a un username. */
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

  const result = await requestFriend(env().DB, user.id, username);
  if (!result.ok) {
    const messages = {
      not_found: 'Utente non trovato',
      self: 'Non puoi aggiungere te stesso',
    } as const;
    return errorJson(404, result.error, messages[result.error]);
  }
  return json({ ok: true, alreadyFriends: result.alreadyFriends });
}
