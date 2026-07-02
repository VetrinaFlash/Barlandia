import { json, sessionCookieHeader } from '@/lib/server';

export const runtime = 'edge';

export async function POST(): Promise<Response> {
  return json({ ok: true }, { headers: { 'Set-Cookie': sessionCookieHeader('', 0) } });
}
