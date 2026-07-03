import { errorJson, json, requireUser, env } from '@/lib/server';
import { setCompanyMotto } from '@barlandia/shared';

/** Aggiorna il motto della compagnia (solo il fondatore). */
export async function PATCH(request: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: { motto?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'bad_request', 'JSON non valido');
  }
  const motto = typeof body.motto === 'string' ? body.motto : '';

  const ok = await setCompanyMotto(env().DB, user.id, motto);
  if (!ok) return errorJson(403, 'not_founder', 'Solo il fondatore può cambiare il motto');
  return json({ ok: true });
}
