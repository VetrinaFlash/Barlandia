import {
  AVATAR_COLOR_SCHEMES,
  CURRENCY,
  LIMITS,
  TX_REASONS,
  creditCurrency,
  hashPassword,
} from '@barlandia/shared';
import {
  createSessionCookie,
  env,
  errorJson,
  json,
  sessionCookieHeader,
} from '@/lib/server';
import { AUTH } from '@barlandia/shared';

const USERNAME_RE = /^[a-z0-9_]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request): Promise<Response> {
  let body: { username?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'bad_request', 'JSON non valido');
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (
    username.length < LIMITS.usernameMin ||
    username.length > LIMITS.usernameMax ||
    !USERNAME_RE.test(username)
  ) {
    return errorJson(
      400,
      'invalid_username',
      `Username: ${LIMITS.usernameMin}-${LIMITS.usernameMax} caratteri, solo lettere, numeri e _`,
    );
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return errorJson(400, 'invalid_email', 'Email non valida');
  }
  if (password.length < LIMITS.passwordMin) {
    return errorJson(400, 'invalid_password', `Password: almeno ${LIMITS.passwordMin} caratteri`);
  }

  const db = env().DB;
  const existing = await db
    .prepare(`SELECT id FROM users WHERE username = ?1 OR email = ?2`)
    .bind(username, email)
    .first();
  if (existing) {
    return errorJson(409, 'already_exists', 'Username o email già registrati');
  }

  const userId = crypto.randomUUID();
  const colorScheme =
    AVATAR_COLOR_SCHEMES[Math.floor(Math.random() * AVATAR_COLOR_SCHEMES.length)] ?? 'terracotta';
  const passwordHash = await hashPassword(password);

  // utente + avatar + wallet in un'unica transazione
  await db.batch([
    db
      .prepare(`INSERT INTO users (id, username, email, password_hash) VALUES (?1, ?2, ?3, ?4)`)
      .bind(userId, username, email, passwordHash),
    db
      .prepare(`INSERT INTO avatar_config (user_id, color_scheme) VALUES (?1, ?2)`)
      .bind(userId, colorScheme),
    db.prepare(`INSERT INTO wallets (user_id, balance) VALUES (?1, 0)`).bind(userId),
  ]);

  // bonus di benvenuto: passa dall'unica funzione che tocca i saldi
  // (scrive anche la riga di log in currency_transactions)
  const balance = await creditCurrency(db, userId, CURRENCY.welcomeBonus, TX_REASONS.welcome);

  const user = { id: userId, username, colorScheme };
  const cookie = await createSessionCookie(user);
  return json(
    { user: { id: userId, username, colorScheme }, balance },
    { status: 201, headers: { 'Set-Cookie': sessionCookieHeader(cookie, AUTH.sessionTtlSeconds) } },
  );
}
