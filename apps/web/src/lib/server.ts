/**
 * Helper server-side per le API route Next.js.
 * Le route girano su Cloudflare Workers (via OpenNext) e accedono ai
 * binding (D1, secrets) tramite getCloudflareContext.
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { cookies } from 'next/headers';
import { AUTH, signToken, verifyToken, type TokenPayload } from '@barlandia/shared';

export function env(): CloudflareEnv {
  return getCloudflareContext().env;
}

export interface SessionUser {
  id: string;
  username: string;
  colorScheme: string;
  outfit: string;
}

/** Legge e verifica il cookie di sessione. null se assente/invalido. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH.sessionCookieName)?.value;
  if (!cookie) return null;
  const payload = await verifyToken(cookie, env().SESSION_SECRET, 'session');
  if (!payload) return null;
  return {
    id: payload.uid,
    username: payload.usr,
    colorScheme: payload.cs,
    outfit: payload.top ?? 'maglia',
  };
}

/** Crea il valore del cookie di sessione firmato. */
export async function createSessionCookie(user: SessionUser): Promise<string> {
  const payload: TokenPayload = {
    uid: user.id,
    usr: user.username,
    cs: user.colorScheme,
    top: user.outfit,
    scp: 'session',
    exp: Math.floor(Date.now() / 1000) + AUTH.sessionTtlSeconds,
  };
  return signToken(payload, env().SESSION_SECRET);
}

export function sessionCookieHeader(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${AUTH.sessionCookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export function errorJson(status: number, code: string, message: string): Response {
  return json({ error: code, message }, { status });
}

/** Guard per route autenticate: ritorna l'utente o una Response 401. */
export async function requireUser(): Promise<SessionUser | Response> {
  const user = await getSessionUser();
  if (!user) return errorJson(401, 'unauthorized', 'Accesso richiesto');
  return user;
}
