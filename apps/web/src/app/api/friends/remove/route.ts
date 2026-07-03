import { removeFriend } from '@barlandia/shared';
import { env, errorJson, json, requireUser } from '@/lib/server';

/** Rimuove un'amicizia esistente, o rifiuta/annulla una richiesta pendente. */
export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: { friendId?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'bad_request', 'JSON non valido');
  }
  const friendId = typeof body.friendId === 'string' ? body.friendId : '';
  if (!friendId) return errorJson(400, 'bad_request', 'friendId mancante');

  const ok = await removeFriend(env().DB, user.id, friendId);
  if (!ok) return errorJson(404, 'not_found', 'Nessuna amicizia da rimuovere');
  return json({ ok: true });
}
