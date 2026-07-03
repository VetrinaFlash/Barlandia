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

import { CURRENCY, DAILY_GOALS, TX_REASONS } from './constants';

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

// ---------------------------------------------------------------------------
// Sprint 1 (game design roadmap): bonus giornaliero + tris del giorno.
// Vedi docs/GAME-DESIGN.md.

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Accredita il bonus giornaliero al primo ingresso del giorno.
 * Ritorna { amount, balance }, o null se già riscosso oggi. `amount` è
 * l'importo del bonus (per il messaggio all'utente), `balance` il saldo
 * risultante (creditCurrency ritorna il saldo, non il delta — vanno
 * tenuti distinti per non mostrare per errore il saldo totale come
 * "importo del bonus" al client).
 * Atomico via INSERT OR IGNORE su chiave (user_id, claim_date): niente
 * race tra tab multiple o riconnessioni ravvicinate.
 */
export async function awardDailyBonus(
  db: D1Database,
  userId: string,
): Promise<{ amount: number; balance: number } | null> {
  const claim = await db
    .prepare(`INSERT OR IGNORE INTO daily_bonus_claims (user_id, claim_date) VALUES (?1, ?2)`)
    .bind(userId, todayUTC())
    .run();
  if ((claim.meta.changes ?? 0) === 0) return null;
  const amount = CURRENCY.dailyBonusAmount;
  const balance = await creditCurrency(db, userId, amount, TX_REASONS.daily);
  return { amount, balance };
}

export interface DailyGoalsState {
  chatCount: number;
  presenceTicks: number;
  emoteCount: number;
  rewardClaimed: boolean;
  chatTarget: number;
  presenceTarget: number;
  emoteTarget: number;
}

export type DailyGoalKind = 'chat' | 'presence' | 'emote';

const GOAL_COLUMN: Record<DailyGoalKind, string> = {
  chat: 'chat_count',
  presence: 'presence_ticks',
  emote: 'emote_count',
};

export async function getDailyGoalsState(db: D1Database, userId: string): Promise<DailyGoalsState> {
  const row = await db
    .prepare(
      `SELECT chat_count, presence_ticks, emote_count, reward_claimed
       FROM daily_goals WHERE user_id = ?1 AND goal_date = ?2`,
    )
    .bind(userId, todayUTC())
    .first<{
      chat_count: number;
      presence_ticks: number;
      emote_count: number;
      reward_claimed: number;
    }>();
  return {
    chatCount: row?.chat_count ?? 0,
    presenceTicks: row?.presence_ticks ?? 0,
    emoteCount: row?.emote_count ?? 0,
    rewardClaimed: (row?.reward_claimed ?? 0) === 1,
    chatTarget: DAILY_GOALS.chatTarget,
    presenceTarget: DAILY_GOALS.presenceTarget,
    emoteTarget: DAILY_GOALS.emoteTarget,
  };
}

/**
 * Incrementa un contatore del tris del giorno (UPDATE atomico, mai
 * read-then-write) e, se tutte le soglie sono raggiunte, riscuote il
 * premio una tantum per la giornata. `kind` arriva sempre da un valore
 * letterale interno (mai dal client), quindi l'uso nel nome colonna è sicuro.
 */
export async function bumpDailyGoal(
  db: D1Database,
  userId: string,
  kind: DailyGoalKind,
): Promise<{ state: DailyGoalsState; awarded: number | null; balance: number | null }> {
  const column = GOAL_COLUMN[kind];
  const today = todayUTC();
  await db
    .prepare(
      `INSERT INTO daily_goals (user_id, goal_date, ${column}) VALUES (?1, ?2, 1)
       ON CONFLICT(user_id, goal_date) DO UPDATE SET ${column} = ${column} + 1`,
    )
    .bind(userId, today)
    .run();

  const claim = await db
    .prepare(
      `UPDATE daily_goals SET reward_claimed = 1
       WHERE user_id = ?1 AND goal_date = ?2 AND reward_claimed = 0
         AND chat_count >= ?3 AND presence_ticks >= ?4 AND emote_count >= ?5`,
    )
    .bind(
      userId,
      today,
      DAILY_GOALS.chatTarget,
      DAILY_GOALS.presenceTarget,
      DAILY_GOALS.emoteTarget,
    )
    .run();

  let awarded: number | null = null;
  let balance: number | null = null;
  if ((claim.meta.changes ?? 0) > 0) {
    awarded = CURRENCY.dailyGoalsReward;
    balance = await creditCurrency(db, userId, awarded, TX_REASONS.dailyGoals);
  }

  return { state: await getDailyGoalsState(db, userId), awarded, balance };
}
