/**
 * Test del RoomDO con 2 client WebSocket simultanei (deliverable Fase 1)
 * e della logica valuta/shop (deliverable Fase 2).
 */
import { SELF, env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  XP,
  awardBadge,
  awardXp,
  bumpDailyGoal,
  creditCurrency,
  getBalance,
  getXpState,
  levelForXp,
  listUserBadges,
  purchaseItem,
  signToken,
  isLayoutBlocked,
  findPath,
  SPAWN,
  type ServerMessage,
} from '@barlandia/shared';

const SECRET = 'segreto-di-test';

async function makeUser(id: string, username: string): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO users (id, username, email, password_hash) VALUES (?1, ?2, ?3, 'x')`,
  )
    .bind(id, username, `${username}@test.it`)
    .run();
}

async function rtToken(uid: string, usr: string): Promise<string> {
  return signToken(
    { uid, usr, cs: 'terracotta', scp: 'rt', exp: Math.floor(Date.now() / 1000) + 60 },
    SECRET,
  );
}

/**
 * Client di test: accoda TUTTI i messaggi dal momento dell'accept, così
 * nextMessage non perde broadcast arrivati prima di mettersi in ascolto.
 */
interface TestClient {
  ws: WebSocket;
  queue: ServerMessage[];
  waiters: Array<() => void>;
  closed: Promise<void>;
}

async function connect(uid: string, usr: string): Promise<TestClient> {
  const token = await rtToken(uid, usr);
  const res = await SELF.fetch(`https://realtime.test/connect?token=${token}`, {
    headers: { Upgrade: 'websocket' },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket;
  if (!ws) throw new Error('webSocket mancante nella risposta 101');

  const client: TestClient = { ws, queue: [], waiters: [], closed: undefined as never };
  ws.addEventListener('message', (ev) => {
    client.queue.push(JSON.parse(ev.data as string) as ServerMessage);
    for (const w of client.waiters.splice(0)) w();
  });
  client.closed = new Promise<void>((resolve) => {
    ws.addEventListener('close', () => resolve());
  });
  ws.accept();
  return client;
}

/** Attende (o estrae dalla coda) il prossimo messaggio che soddisfa il predicato. */
async function nextMessage(
  client: TestClient,
  match: (m: ServerMessage) => boolean,
  timeoutMs = 2000,
): Promise<ServerMessage> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const idx = client.queue.findIndex(match);
    if (idx >= 0) {
      const [msg] = client.queue.splice(idx, 1);
      return msg as ServerMessage;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('timeout in attesa del messaggio');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = client.waiters.indexOf(onPush);
        if (i >= 0) client.waiters.splice(i, 1);
        reject(new Error('timeout in attesa del messaggio'));
      }, remaining);
      const onPush = () => {
        clearTimeout(timer);
        resolve();
      };
      client.waiters.push(onPush);
    });
  }
}

describe('RoomDO — 2 client simultanei', () => {
  beforeAll(async () => {
    await makeUser('u-anna', 'anna');
    await makeUser('u-bruno', 'bruno');
  });

  it('rifiuta la connessione senza token valido', async () => {
    const res = await SELF.fetch('https://realtime.test/connect?token=falso', {
      headers: { Upgrade: 'websocket' },
    });
    expect(res.status).toBe(401);
  });

  it('join, presenza reciproca, move e chat in tempo reale', async () => {
    const wsAnna = await connect('u-anna', 'anna');
    const welcomeAnna = (await nextMessage(wsAnna, (m) => m.type === 'welcome')) as Extract<
      ServerMessage,
      { type: 'welcome' }
    >;
    expect(welcomeAnna.self.username).toBe('anna');

    // Bruno entra: Anna riceve user_joined, Bruno riceve welcome con Anna dentro
    const joinedPromise = nextMessage(wsAnna, (m) => m.type === 'user_joined');
    const wsBruno = await connect('u-bruno', 'bruno');
    const welcomeBruno = (await nextMessage(wsBruno, (m) => m.type === 'welcome')) as Extract<
      ServerMessage,
      { type: 'welcome' }
    >;
    const joined = (await joinedPromise) as Extract<ServerMessage, { type: 'user_joined' }>;
    expect(joined.user.username).toBe('bruno');
    expect(welcomeBruno.users.map((u) => u.username)).toContain('anna');

    // move verso il bancone (bloccato) → errore, nessun broadcast
    // (fatto PRIMA del move valido: il rate-limit server scarta i move
    // ravvicinati e il percorso d'errore non consuma il rate-limit)
    const errPromise = nextMessage(wsAnna, (m) => m.type === 'error');
    wsAnna.ws.send(JSON.stringify({ type: 'move', targetX: 4, targetY: 1 }));
    const err = (await errPromise) as Extract<ServerMessage, { type: 'error' }>;
    expect(err.code).toBe('invalid_target');

    // move di Anna → broadcast a Bruno, destinazione valida
    const target = { x: 5, y: 5 };
    expect(isLayoutBlocked(target.x, target.y)).toBe(false);
    const movedPromise = nextMessage(wsBruno, (m) => m.type === 'user_moved');
    wsAnna.ws.send(JSON.stringify({ type: 'move', targetX: target.x, targetY: target.y }));
    const moved = (await movedPromise) as Extract<ServerMessage, { type: 'user_moved' }>;
    expect(moved.userId).toBe('u-anna');
    expect(moved.targetX).toBe(5);
    expect(moved.targetY).toBe(5);

    // chat di Bruno → arriva ad Anna con timestamp server
    const chatPromise = nextMessage(wsAnna, (m) => m.type === 'chat');
    wsBruno.ws.send(JSON.stringify({ type: 'chat', text: 'Ciao, un caffè per favore!' }));
    const chat = (await chatPromise) as Extract<ServerMessage, { type: 'chat' }>;
    expect(chat.entry.username).toBe('bruno');
    expect(chat.entry.text).toBe('Ciao, un caffè per favore!');
    expect(chat.entry.at).toBeGreaterThan(0);

    // Bruno esce → Anna riceve user_left
    const leftPromise = nextMessage(wsAnna, (m) => m.type === 'user_left');
    wsBruno.ws.close();
    const left = (await leftPromise) as Extract<ServerMessage, { type: 'user_left' }>;
    expect(left.userId).toBe('u-bruno');

    wsAnna.ws.close();
  });

  it('la seconda connessione dello stesso utente sostituisce la prima', async () => {
    const ws1 = await connect('u-anna', 'anna');
    await nextMessage(ws1, (m) => m.type === 'welcome');
    const ws2 = await connect('u-anna', 'anna');
    await nextMessage(ws2, (m) => m.type === 'welcome');
    // ws1 viene chiusa dal server con codice 4000
    await ws1.closed;
    ws2.ws.close();
  });
});

describe('Valuta e shop (D1)', () => {
  beforeAll(async () => {
    await makeUser('u-carla', 'carla');
  });

  it('creditCurrency crea il wallet, aggiorna il saldo e logga la transazione', async () => {
    const balance = await creditCurrency(env.DB, 'u-carla', 50, 'bonus_benvenuto');
    expect(balance).toBe(50);
    const txs = await env.DB.prepare(
      `SELECT amount, reason FROM currency_transactions WHERE user_id = 'u-carla'`,
    ).all<{ amount: number; reason: string }>();
    expect(txs.results).toEqual([{ amount: 50, reason: 'bonus_benvenuto' }]);
  });

  it("l'acquisto è atomico: con saldo sufficiente scala e aggiunge all'inventario", async () => {
    const result = await purchaseItem(env.DB, 'u-carla', 'sgabello'); // prezzo 15
    expect(result.ok).toBe(true);
    expect(result.balance).toBe(35);
    const inv = await env.DB.prepare(
      `SELECT item_id, is_placed FROM inventory WHERE user_id = 'u-carla'`,
    ).all<{ item_id: string; is_placed: number }>();
    expect(inv.results).toEqual([{ item_id: 'sgabello', is_placed: 0 }]);
    // il log ha ANCHE la riga negativa dell'acquisto
    const txCount = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM currency_transactions WHERE user_id = 'u-carla'`,
    ).first<{ n: number }>();
    expect(txCount?.n).toBe(2);
  });

  it('con saldo insufficiente non scrive NULLA (né wallet né inventario né log)', async () => {
    const result = await purchaseItem(env.DB, 'u-carla', 'biliardino'); // prezzo 150 > 35
    expect(result.ok).toBe(false);
    expect(result.error).toBe('insufficient_funds');
    expect(await getBalance(env.DB, 'u-carla')).toBe(35);
    const inv = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM inventory WHERE user_id = 'u-carla'`,
    ).first<{ n: number }>();
    expect(inv?.n).toBe(1); // solo lo sgabello di prima
    const txCount = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM currency_transactions WHERE user_id = 'u-carla'`,
    ).first<{ n: number }>();
    expect(txCount?.n).toBe(2); // nessuna transazione aggiunta
  });

  it('articolo inesistente → item_not_found', async () => {
    const result = await purchaseItem(env.DB, 'u-carla', 'non-esiste');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('item_not_found');
  });
});

describe('Piazzamento arredi via WS', () => {
  beforeAll(async () => {
    await makeUser('u-dario', 'dario');
    await makeUser('u-elena', 'elena');
    await creditCurrency(env.DB, 'u-dario', 100, 'bonus_test');
  });

  it('piazzamento visibile in tempo reale agli altri client, con verifica ownership', async () => {
    const buy = await purchaseItem(env.DB, 'u-dario', 'tavolino');
    expect(buy.ok).toBe(true);
    const invId = buy.inventoryId as string;

    const wsDario = await connect('u-dario', 'dario');
    await nextMessage(wsDario, (m) => m.type === 'welcome');
    const wsElena = await connect('u-elena', 'elena');
    await nextMessage(wsElena, (m) => m.type === 'welcome');

    // Elena prova a piazzare l'arredo di Dario → not_owner
    const errPromise = nextMessage(wsElena, (m) => m.type === 'error');
    wsElena.ws.send(JSON.stringify({ type: 'place_item', inventoryId: invId, x: 3, y: 3 }));
    const err = (await errPromise) as Extract<ServerMessage, { type: 'error' }>;
    expect(err.code).toBe('not_owner');

    // Dario piazza → Elena lo vede in tempo reale
    const placedPromise = nextMessage(wsElena, (m) => m.type === 'item_placed');
    wsDario.ws.send(JSON.stringify({ type: 'place_item', inventoryId: invId, x: 3, y: 3 }));
    const placed = (await placedPromise) as Extract<ServerMessage, { type: 'item_placed' }>;
    expect(placed.placement.spriteKey).toBe('tavolino');
    expect(placed.placement.x).toBe(3);
    expect(placed.placement.ownerId).toBe('u-dario');

    // su D1 risulta piazzato
    const row = await env.DB.prepare(`SELECT is_placed, placed_x FROM inventory WHERE id = ?1`)
      .bind(invId)
      .first<{ is_placed: number; placed_x: number }>();
    expect(row).toEqual({ is_placed: 1, placed_x: 3 });

    // la tile ora è bloccata per il movimento
    expect(findPath(SPAWN, { x: 3, y: 3 }, new Set(['3,3']))).toBeNull();

    // pickup → item_removed broadcast
    const removedPromise = nextMessage(wsElena, (m) => m.type === 'item_removed');
    wsDario.ws.send(JSON.stringify({ type: 'pickup_item', inventoryId: invId }));
    const removed = (await removedPromise) as Extract<ServerMessage, { type: 'item_removed' }>;
    expect(removed.inventoryId).toBe(invId);

    wsDario.ws.close();
    wsElena.ws.close();
  });
});

describe('Bonus giornaliero', () => {
  beforeAll(async () => {
    await makeUser('u-fabio', 'fabio');
  });

  it('si accredita al primo ingresso del giorno, non al secondo', async () => {
    const ws1 = await connect('u-fabio', 'fabio');
    const welcome1 = (await nextMessage(ws1, (m) => m.type === 'welcome')) as Extract<
      ServerMessage,
      { type: 'welcome' }
    >;
    expect(welcome1.dailyBonusAwarded).toBe(5);
    expect(welcome1.balance).toBe(5);
    ws1.ws.close();

    const ws2 = await connect('u-fabio', 'fabio');
    const welcome2 = (await nextMessage(ws2, (m) => m.type === 'welcome')) as Extract<
      ServerMessage,
      { type: 'welcome' }
    >;
    expect(welcome2.dailyBonusAwarded).toBeNull();
    expect(welcome2.balance).toBe(5); // invariato: niente doppio accredito
    ws2.ws.close();
  });
});

describe('Tris del giorno', () => {
  beforeAll(async () => {
    await makeUser('u-giulia', 'giulia');
  });

  it('chat ed emote incrementano i goal; le emote sono rate-limited; il tris completo paga il premio', async () => {
    const ws = await connect('u-giulia', 'giulia');
    await nextMessage(ws, (m) => m.type === 'welcome');

    // 3 messaggi chat → soddisfano il goal 'chat' (target 3)
    for (let i = 0; i < 3; i++) {
      const updPromise = nextMessage(ws, (m) => m.type === 'daily_goals_update');
      ws.ws.send(JSON.stringify({ type: 'chat', text: `messaggio ${i}` }));
      await updPromise;
      await new Promise((r) => setTimeout(r, 550)); // > chatMinIntervalMs
    }

    // 1 emote → soddisfa il goal 'emote' (target 1)
    const emoteUpdPromise = nextMessage(ws, (m) => m.type === 'daily_goals_update');
    ws.ws.send(JSON.stringify({ type: 'emote', emote: 'wave' }));
    const goalsAfterEmote = (await emoteUpdPromise) as Extract<
      ServerMessage,
      { type: 'daily_goals_update' }
    >;
    expect(goalsAfterEmote.goals.chatCount).toBe(3);
    expect(goalsAfterEmote.goals.emoteCount).toBe(1);
    expect(goalsAfterEmote.rewardAwarded).toBeNull(); // manca ancora 'presence'

    // una seconda emote troppo ravvicinata viene rifiutata (rate-limit)
    const rateLimitPromise = nextMessage(ws, (m) => m.type === 'error');
    ws.ws.send(JSON.stringify({ type: 'emote', emote: 'clap' }));
    const rateLimitErr = (await rateLimitPromise) as Extract<ServerMessage, { type: 'error' }>;
    expect(rateLimitErr.code).toBe('rate_limited');

    // 'presence' si accredita dall'alarm periodico: lo simuliamo chiamando
    // direttamente la stessa funzione D1 che usa l'alarm (vedi bumpGoalAndNotify)
    await bumpDailyGoal(env.DB, 'u-giulia', 'presence');
    const final = await bumpDailyGoal(env.DB, 'u-giulia', 'presence'); // target 2 → completo
    expect(final.state.rewardClaimed).toBe(true);
    expect(final.awarded).toBe(10);
    expect(final.balance).not.toBeNull();

    // riscosso una volta sola: un'ulteriore chiamata non paga di nuovo
    const again = await bumpDailyGoal(env.DB, 'u-giulia', 'presence');
    expect(again.awarded).toBeNull();

    ws.ws.close();
  });
});

describe('Sedersi su un arredo', () => {
  beforeAll(async () => {
    await makeUser('u-marco', 'marco');
    await makeUser('u-nadia', 'nadia');
    await creditCurrency(env.DB, 'u-marco', 100, 'bonus_test');
  });

  it('sedersi vicino a uno sgabello, occupazione esclusiva, alzata automatica su move', async () => {
    const buy = await purchaseItem(env.DB, 'u-marco', 'sgabello');
    expect(buy.ok).toBe(true);
    const invId = buy.inventoryId as string;

    const wsMarco = await connect('u-marco', 'marco');
    await nextMessage(wsMarco, (m) => m.type === 'welcome');
    const wsNadia = await connect('u-nadia', 'nadia');
    await nextMessage(wsNadia, (m) => m.type === 'welcome');

    // Nadia si allontana, così il test "troppo lontano" è indipendente
    // dall'algoritmo di spawn (che potrebbe metterla vicino per caso)
    const nadiaMovedPromise = nextMessage(wsNadia, (m) => m.type === 'user_moved');
    wsNadia.ws.send(JSON.stringify({ type: 'move', targetX: 10, targetY: 10 }));
    await nadiaMovedPromise;

    // sgabello piazzato adiacente allo spawn di Marco
    const seatTile = { x: SPAWN.x, y: SPAWN.y - 1 };
    const placedPromise = nextMessage(wsNadia, (m) => m.type === 'item_placed');
    wsMarco.ws.send(
      JSON.stringify({ type: 'place_item', inventoryId: invId, x: seatTile.x, y: seatTile.y }),
    );
    await placedPromise;

    // troppo lontano: rifiutato
    const tooFarPromise = nextMessage(wsNadia, (m) => m.type === 'error');
    wsNadia.ws.send(JSON.stringify({ type: 'sit', inventoryId: invId }));
    const tooFar = (await tooFarPromise) as Extract<ServerMessage, { type: 'error' }>;
    expect(tooFar.code).toBe('too_far');

    // Marco si siede (è adiacente)
    const satPromise = nextMessage(wsNadia, (m) => m.type === 'user_sat');
    wsMarco.ws.send(JSON.stringify({ type: 'sit', inventoryId: invId }));
    const sat = (await satPromise) as Extract<ServerMessage, { type: 'user_sat' }>;
    expect(sat.userId).toBe('u-marco');
    expect(sat.x).toBe(seatTile.x);
    expect(sat.y).toBe(seatTile.y);

    // Marco cammina via → si alza automaticamente (broadcast a Nadia)
    const stoodPromise = nextMessage(wsNadia, (m) => m.type === 'user_stood');
    wsMarco.ws.send(JSON.stringify({ type: 'move', targetX: 5, targetY: 5 }));
    const stood = (await stoodPromise) as Extract<ServerMessage, { type: 'user_stood' }>;
    expect(stood.userId).toBe('u-marco');

    // alzarsi di nuovo (già in piedi) → errore
    const notSeatedPromise = nextMessage(wsMarco, (m) => m.type === 'error');
    wsMarco.ws.send(JSON.stringify({ type: 'stand' }));
    const notSeated = (await notSeatedPromise) as Extract<ServerMessage, { type: 'error' }>;
    expect(notSeated.code).toBe('not_seated');

    wsMarco.ws.close();
    wsNadia.ws.close();
  });
});

describe('Badge', () => {
  beforeAll(async () => {
    await makeUser('u-paolo', 'paolo');
    await makeUser('u-rita', 'rita');
  });

  it('awardBadge è idempotente (nessun doppio badge)', async () => {
    const first = await awardBadge(env.DB, 'u-paolo', 'primi_100');
    expect(first?.id).toBe('primi_100');
    const second = await awardBadge(env.DB, 'u-paolo', 'primi_100');
    expect(second).toBeNull();
    const badges = await listUserBadges(env.DB, 'u-paolo');
    expect(badges.map((b) => b.id)).toEqual(['primi_100']);
  });

  it('la prima emote cheers assegna primo_brindisi, non due volte', async () => {
    const ws = await connect('u-paolo', 'paolo');
    await nextMessage(ws, (m) => m.type === 'welcome');

    const badgePromise = nextMessage(ws, (m) => m.type === 'badge_earned');
    ws.ws.send(JSON.stringify({ type: 'emote', emote: 'cheers' }));
    const badge = (await badgePromise) as Extract<ServerMessage, { type: 'badge_earned' }>;
    expect(badge.badgeId).toBe('primo_brindisi');

    await new Promise((r) => setTimeout(r, 1600)); // supera emoteMinIntervalMs
    const emotePromise = nextMessage(ws, (m) => m.type === 'emote');
    ws.ws.send(JSON.stringify({ type: 'emote', emote: 'cheers' }));
    await emotePromise;

    const badges = await listUserBadges(env.DB, 'u-paolo');
    expect(badges.filter((b) => b.id === 'primo_brindisi')).toHaveLength(1);

    ws.ws.close();
  });

  it('assegna prima_serata la prima volta che il tris del giorno viene completato', async () => {
    // presenza già a soglia, come farebbe l'alarm periodico
    await bumpDailyGoal(env.DB, 'u-rita', 'presence');
    await bumpDailyGoal(env.DB, 'u-rita', 'presence');

    const ws = await connect('u-rita', 'rita');
    await nextMessage(ws, (m) => m.type === 'welcome');

    for (let i = 0; i < 3; i++) {
      const upd = nextMessage(ws, (m) => m.type === 'daily_goals_update');
      ws.ws.send(JSON.stringify({ type: 'chat', text: `msg ${i}` }));
      await upd;
      await new Promise((r) => setTimeout(r, 550));
    }

    const badgePromise = nextMessage(ws, (m) => m.type === 'badge_earned');
    ws.ws.send(JSON.stringify({ type: 'emote', emote: 'wave' })); // completa il tris
    const badge = (await badgePromise) as Extract<ServerMessage, { type: 'badge_earned' }>;
    expect(badge.badgeId).toBe('prima_serata');

    ws.ws.close();
  });
});

describe('Livelli "Habitué" (XP)', () => {
  beforeAll(async () => {
    await makeUser('u-sara', 'sara');
    await makeUser('u-tommaso', 'tommaso');
  });

  it('levelForXp: soglie corrette e livello massimo senza prossimo traguardo', () => {
    expect(levelForXp(0)).toMatchObject({ level: 1, title: 'Nuovo Avventore' });
    expect(levelForXp(79)).toMatchObject({ level: 1 });
    expect(levelForXp(80)).toMatchObject({ level: 2, title: 'Habitué' });
    const max = levelForXp(999999);
    expect(max.title).toBe('Leggenda di Barlandia');
    expect(max.xpForNextLevel).toBe(0);
  });

  it('awardXp accredita, aggiorna il livello quando si supera una soglia e rispetta il cap giornaliero', async () => {
    const first = await awardXp(env.DB, 'u-sara', 50);
    expect(first).toMatchObject({ gained: 50, totalXp: 50 });
    expect(first?.levelBefore.level).toBe(1);
    expect(first?.levelAfter.level).toBe(1);

    // 50 + 40 = 90 → supera la soglia (80) del livello 2
    const levelUp = await awardXp(env.DB, 'u-sara', 40);
    expect(levelUp?.totalXp).toBe(90);
    expect(levelUp?.levelBefore.level).toBe(1);
    expect(levelUp?.levelAfter.level).toBe(2);

    // il cap giornaliero è 120: già guadagnati 90, ne restano 30 disponibili oggi
    const capped = await awardXp(env.DB, 'u-sara', 100);
    expect(capped?.gained).toBe(30);
    expect(capped?.totalXp).toBe(120);

    // cap saturo: nessun ulteriore accredito oggi
    const blocked = await awardXp(env.DB, 'u-sara', 10);
    expect(blocked).toBeNull();
    expect(await getXpState(env.DB, 'u-sara')).toBe(120);
  });

  it('un utente nuovo parte con xp 0 nel welcome; un badge guadagnato accredita XP', async () => {
    const ws = await connect('u-tommaso', 'tommaso');
    const welcome = (await nextMessage(ws, (m) => m.type === 'welcome')) as Extract<
      ServerMessage,
      { type: 'welcome' }
    >;
    expect(welcome.xp).toBe(0);

    const xpPromise = nextMessage(ws, (m) => m.type === 'xp_earned');
    ws.ws.send(JSON.stringify({ type: 'emote', emote: 'cheers' })); // assegna primo_brindisi
    const xp = (await xpPromise) as Extract<ServerMessage, { type: 'xp_earned' }>;
    expect(xp.amount).toBe(XP.badgeEarned);
    expect(xp.totalXp).toBe(XP.badgeEarned);
    expect(xp.leveledUp).toBe(false);

    ws.ws.close();
  });
});
