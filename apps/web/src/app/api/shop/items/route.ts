import { env, json, requireUser } from '@/lib/server';

export const runtime = 'edge';

export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const rows = await env()
    .DB.prepare(
      `SELECT id, name, price, sprite_key AS spriteKey, category
       FROM shop_items ORDER BY price ASC`,
    )
    .all();
  return json({ items: rows.results });
}
