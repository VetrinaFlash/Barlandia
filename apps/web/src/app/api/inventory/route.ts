import { env, json, requireUser } from '@/lib/server';

export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const rows = await env()
    .DB.prepare(
      `SELECT i.id, i.item_id AS itemId, s.name, s.sprite_key AS spriteKey, s.category,
              i.is_placed AS isPlaced, i.placed_x AS placedX, i.placed_y AS placedY
       FROM inventory i JOIN shop_items s ON s.id = i.item_id
       WHERE i.user_id = ?1
       ORDER BY i.acquired_at DESC`,
    )
    .bind(user.id)
    .all();
  return json({ items: rows.results });
}
