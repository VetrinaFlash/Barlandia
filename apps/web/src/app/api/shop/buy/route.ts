import { purchaseItem } from '@barlandia/shared';
import { env, errorJson, json, requireUser } from '@/lib/server';

export const runtime = 'edge';

/**
 * Acquisto: la validazione del saldo e la scrittura di wallet +
 * transazione + inventario avvengono in un'unica transazione atomica
 * su D1 (vedi purchaseItem in packages/shared). Il prezzo NON arriva
 * mai dal client: si legge da shop_items lato server.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: { itemId?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'bad_request', 'JSON non valido');
  }
  const itemId = typeof body.itemId === 'string' ? body.itemId : '';
  if (!itemId || itemId.length > 64) {
    return errorJson(400, 'bad_request', 'itemId mancante');
  }

  const result = await purchaseItem(env().DB, user.id, itemId);
  if (!result.ok) {
    if (result.error === 'item_not_found') {
      return errorJson(404, 'item_not_found', 'Articolo inesistente');
    }
    return errorJson(402, 'insufficient_funds', 'Chicchi insufficienti');
  }
  return json({ ok: true, inventoryId: result.inventoryId, balance: result.balance });
}
