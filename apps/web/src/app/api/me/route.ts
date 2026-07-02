import { getBalance } from '@barlandia/shared';
import { env, json, requireUser } from '@/lib/server';

export const runtime = 'edge';

export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const balance = await getBalance(env().DB, user.id);
  return json({ user, balance });
}
