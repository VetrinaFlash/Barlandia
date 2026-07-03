import { listAllBadges, listUserBadges } from '@barlandia/shared';
import { env, json, requireUser } from '@/lib/server';

export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const db = env().DB;
  const [earned, all] = await Promise.all([listUserBadges(db, user.id), listAllBadges(db)]);
  const earnedIds = new Set(earned.map((b) => b.id));
  const badges = all.map((b) => ({ ...b, earned: earnedIds.has(b.id) }));
  return json({ user, badges });
}
