import { AUTH, AVATAR_COLOR_SCHEMES } from '@barlandia/shared';
import {
  createSessionCookie,
  env,
  errorJson,
  json,
  requireUser,
  sessionCookieHeader,
} from '@/lib/server';

/**
 * Cambia lo schema colore dell'avatar. Riemette il cookie di sessione
 * con il nuovo valore: `colorScheme` è firmato nel token (evita una
 * query D1 a ogni richiesta), quindi va aggiornato lì per avere effetto
 * subito. Il client riconnette il WebSocket dopo la risposta per
 * propagare il cambiamento agli altri utenti nella stanza.
 */
export async function PATCH(request: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: { colorScheme?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'bad_request', 'JSON non valido');
  }
  const colorScheme = typeof body.colorScheme === 'string' ? body.colorScheme : '';
  if (!AVATAR_COLOR_SCHEMES.includes(colorScheme as (typeof AVATAR_COLOR_SCHEMES)[number])) {
    return errorJson(400, 'invalid_color_scheme', 'Schema colore non valido');
  }

  await env()
    .DB.prepare(
      `INSERT INTO avatar_config (user_id, color_scheme) VALUES (?1, ?2)
       ON CONFLICT(user_id) DO UPDATE SET color_scheme = ?2`,
    )
    .bind(user.id, colorScheme)
    .run();

  const updated = { ...user, colorScheme };
  const cookie = await createSessionCookie(updated);
  return json(
    { user: updated },
    { headers: { 'Set-Cookie': sessionCookieHeader(cookie, AUTH.sessionTtlSeconds) } },
  );
}
