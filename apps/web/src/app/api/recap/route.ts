import {
  CURRENCY,
  eventoDelGiorno,
  getBalance,
  getDailyGoalsState,
  listBadgesEarnedToday,
} from '@barlandia/shared';
import { env, json, requireUser } from '@/lib/server';

/**
 * "Cartolina della serata": riepilogo di oggi, tutto da dati già
 * tracciati (tris del giorno, badge, saldo) — nessuna tabella nuova.
 * I minuti di presenza sono una stima (tick di guadagno passivo ×
 * intervallo), non un cronometro esatto.
 */
export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const db = env().DB;

  const [balance, dailyGoals, badgesToday] = await Promise.all([
    getBalance(db, user.id),
    getDailyGoalsState(db, user.id),
    listBadgesEarnedToday(db, user.id),
  ]);

  const presenceMinutesApprox = Math.round(
    (dailyGoals.presenceTicks * CURRENCY.earnIntervalMs) / 60000,
  );

  return json({
    user,
    balance,
    dailyGoals,
    badgesToday,
    presenceMinutesApprox,
    oggi: eventoDelGiorno(new Date()),
  });
}
