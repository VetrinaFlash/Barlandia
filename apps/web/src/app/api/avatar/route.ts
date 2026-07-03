import { AUTH, AVATAR_COLOR_SCHEMES, AVATAR_OUTFITS } from '@barlandia/shared';
import {
  createSessionCookie,
  env,
  errorJson,
  json,
  requireUser,
  sessionCookieHeader,
} from '@/lib/server';

/**
 * Cambia colore e/o vestiario dell'avatar (ognuno opzionale, si può
 * aggiornare uno solo). Riemette il cookie di sessione con i nuovi
 * valori: sono firmati nel token (evita una query D1 a ogni richiesta),
 * quindi vanno aggiornati lì per avere effetto subito. Il client
 * riconnette il WebSocket dopo la risposta per propagare il cambiamento
 * agli altri utenti nella stanza.
 */
export async function PATCH(request: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: { colorScheme?: unknown; outfit?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'bad_request', 'JSON non valido');
  }

  const wantsColor = body.colorScheme !== undefined;
  const wantsOutfit = body.outfit !== undefined;
  if (!wantsColor && !wantsOutfit) {
    return errorJson(400, 'bad_request', 'Nessun campo da aggiornare');
  }

  const colorScheme = wantsColor ? String(body.colorScheme) : user.colorScheme;
  if (wantsColor && !AVATAR_COLOR_SCHEMES.includes(colorScheme as (typeof AVATAR_COLOR_SCHEMES)[number])) {
    return errorJson(400, 'invalid_color_scheme', 'Schema colore non valido');
  }
  const outfit = wantsOutfit ? String(body.outfit) : user.outfit;
  if (wantsOutfit && !AVATAR_OUTFITS.includes(outfit as (typeof AVATAR_OUTFITS)[number])) {
    return errorJson(400, 'invalid_outfit', 'Vestiario non valido');
  }

  await env()
    .DB.prepare(
      `INSERT INTO avatar_config (user_id, color_scheme, top) VALUES (?1, ?2, ?3)
       ON CONFLICT(user_id) DO UPDATE SET color_scheme = ?2, top = ?3`,
    )
    .bind(user.id, colorScheme, outfit)
    .run();

  const updated = { ...user, colorScheme, outfit };
  const cookie = await createSessionCookie(updated);
  return json(
    { user: updated },
    { headers: { 'Set-Cookie': sessionCookieHeader(cookie, AUTH.sessionTtlSeconds) } },
  );
}
