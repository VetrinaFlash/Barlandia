import { AUTH, normalizeOutfit, verifyPassword } from '@barlandia/shared';
import {
  createSessionCookie,
  env,
  errorJson,
  json,
  sessionCookieHeader,
} from '@/lib/server';

export async function POST(request: Request): Promise<Response> {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'bad_request', 'JSON non valido');
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return errorJson(400, 'bad_request', 'Email e password richieste');
  }

  const db = env().DB;
  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.password_hash, COALESCE(a.color_scheme, 'terracotta') AS color_scheme,
              a.top AS top
       FROM users u LEFT JOIN avatar_config a ON a.user_id = u.id
       WHERE u.email = ?1`,
    )
    .bind(email)
    .first<{
      id: string;
      username: string;
      password_hash: string;
      color_scheme: string;
      top: string | null;
    }>();

  // verifica sempre la password anche se l'utente non esiste
  // (riduce l'oracolo di timing sull'esistenza dell'email)
  const ok = await verifyPassword(
    password,
    row?.password_hash ?? 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  );
  if (!row || !ok) {
    return errorJson(401, 'invalid_credentials', 'Email o password errati');
  }

  await db.prepare(`UPDATE users SET last_seen_at = unixepoch() WHERE id = ?1`).bind(row.id).run();

  const user = {
    id: row.id,
    username: row.username,
    colorScheme: row.color_scheme,
    outfit: normalizeOutfit(row.top),
  };
  const cookie = await createSessionCookie(user);
  return json(
    { user },
    { headers: { 'Set-Cookie': sessionCookieHeader(cookie, AUTH.sessionTtlSeconds) } },
  );
}
