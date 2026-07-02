/**
 * Logica valuta ("Chicchi") — UNICO punto del codice che tocca
 * wallets.balance. Ogni variazione scrive SEMPRE una riga in
 * currency_transactions (log append-only: mai UPDATE/DELETE su quelle righe).
 *
 * Tutte le operazioni usano db.batch(), che D1 esegue in una transazione
 * atomica: o passano tutte le statement, o nessuna.
 *
 * Questa è la parte da auditare con più attenzione prima di introdurre
 * il trading tra utenti (fase futura) — vedi README.
 */

/// <reference types="@cloudflare/workers-types" />

export interface PurchaseResult {
  ok: boolean;
  error?: 'insufficient_funds' | 'item_not_found';
  /** id della nuova riga inventory, se ok */
  inventoryId?: string;
  /** saldo dopo l'operazione (solo se ok) */
  balance?: number;
}

/**
 * Accredita `amount` (> 0) all'utente, loggando il motivo.
 * Crea il wallet se non esiste (upsert). Ritorna il nuovo saldo.
 */
export async function creditCurrency(
  db: D1Database,
  userId: string,
  amount: number,
  reason: string,
): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`creditCurrency: amount non valido (${amount})`);
  }
  const txId = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO currency_transactions (id, user_id, amount, reason) VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(txId, userId, amount, reason),
    db
      .prepare(
        `INSERT INTO wallets (user_id, balance, updated_at) VALUES (?1, ?2, unixepoch())
         ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?2, updated_at = unixepoch()`,
      )
      .bind(userId, amount),
  ]);
  const row = await db
    .prepare(`SELECT balance FROM wallets WHERE user_id = ?1`)
    .bind(userId)
    .first<{ balance: number }>();
  return row?.balance ?? amount;
}

/**
 * Acquisto atomico di un articolo dello shop.
 *
 * Le tre statement girano in un'unica transazione D1 (batch) e sono
 * concatenate con la funzione SQLite changes():
 *   1. UPDATE wallets ... WHERE balance >= prezzo   (guardia sul saldo)
 *   2. INSERT log transazione  ... WHERE changes() > 0   (solo se 1 è passata)
 *   3. INSERT inventory        ... WHERE changes() > 0   (solo se 2 è passata)
 * Se il saldo è insufficiente la UPDATE non tocca righe e la catena si
 * ferma: nessuna scrittura. Se una statement fallisce, il batch fa rollback.
 */
export async function purchaseItem(
  db: D1Database,
  userId: string,
  itemId: string,
): Promise<PurchaseResult> {
  const item = await db
    .prepare(`SELECT id, price FROM shop_items WHERE id = ?1`)
    .bind(itemId)
    .first<{ id: string; price: number }>();
  if (!item) return { ok: false, error: 'item_not_found' };

  const txId = crypto.randomUUID();
  const invId = crypto.randomUUID();

  const results = await db.batch([
    db
      .prepare(
        `UPDATE wallets SET balance = balance - ?1, updated_at = unixepoch()
         WHERE user_id = ?2 AND balance >= ?1`,
      )
      .bind(item.price, userId),
    db
      .prepare(
        `INSERT INTO currency_transactions (id, user_id, amount, reason)
         SELECT ?1, ?2, ?3, ?4 WHERE changes() > 0`,
      )
      .bind(txId, userId, -item.price, `acquisto_shop:${item.id}`),
    db
      .prepare(
        `INSERT INTO inventory (id, user_id, item_id)
         SELECT ?1, ?2, ?3 WHERE changes() > 0`,
      )
      .bind(invId, userId, item.id),
  ]);

  const walletUpdated = (results[0]?.meta.changes ?? 0) > 0;
  if (!walletUpdated) return { ok: false, error: 'insufficient_funds' };

  const row = await db
    .prepare(`SELECT balance FROM wallets WHERE user_id = ?1`)
    .bind(userId)
    .first<{ balance: number }>();
  return { ok: true, inventoryId: invId, balance: row?.balance ?? 0 };
}

export async function getBalance(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT balance FROM wallets WHERE user_id = ?1`)
    .bind(userId)
    .first<{ balance: number }>();
  return row?.balance ?? 0;
}
