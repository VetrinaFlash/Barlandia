/**
 * RoomDO — Durable Object della stanza unica di Barlandia.
 *
 * Usa la WebSocket Hibernation API: il DO può essere scaricato dalla
 * memoria tra un messaggio e l'altro senza chiudere le connessioni
 * (costi contenuti quando il bar è tranquillo). Per questo TUTTO lo stato
 * per-connessione vive nell'attachment serializzato del WebSocket, e lo
 * stato di stanza (chat, arredi) vive in storage/D1 — la memoria è solo
 * una cache ricostruibile.
 *
 * Responsabilità:
 *  - presenza: join/leave, posizioni, broadcast
 *  - movimento: validazione destinazione (bounds + layout + arredi)
 *  - chat: validazione, rate-limit, storico ultimi N messaggi
 *  - arredi: piazzamento/rimozione con verifica ownership su D1
 *  - valuta passiva: alarm periodico che accredita i presenti attivi
 */

import {
  CURRENCY,
  LIMITS,
  TX_REASONS,
  awardBadge,
  awardDailyBonus,
  bumpDailyGoal,
  creditCurrency,
  getBalance,
  getDailyGoalsState,
  isInBounds,
  isWalkable,
  tileKey,
  findSpawnTile,
  parseClientMessage,
  type ChatEntry,
  type EmoteType,
  type Placement,
  type RoomUser,
  type ServerMessage,
} from '@barlandia/shared';
import type { Env } from './index';

/** Stato per-connessione, serializzato nell'attachment (sopravvive all'ibernazione). */
interface ConnState {
  uid: string;
  usr: string;
  cs: string;
  x: number;
  y: number;
  /** ultimo segnale di attività (heartbeat/move/chat), epoch ms */
  lastActiveAt: number;
  lastMoveAt: number;
  lastChatAt: number;
  lastEmoteAt: number;
  /** inventoryId del posto su cui è seduto, se seduto. */
  seatedOn?: string;
}

const CHAT_STORAGE_KEY = 'chat_history';

export class RoomDO implements DurableObject {
  private placements: Map<string, Placement> | null = null; // cache, chiave = inventoryId

  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}

  // -------------------------------------------------------------------------
  // Ingresso: upgrade WebSocket (già autenticato dal worker)

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/ws' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Not found', { status: 404 });
    }

    const uid = request.headers.get('X-Barlandia-User-Id');
    const usr = request.headers.get('X-Barlandia-Username');
    const cs = request.headers.get('X-Barlandia-Color-Scheme') ?? 'terracotta';
    if (!uid || !usr) return new Response('Identità mancante', { status: 400 });

    // Una connessione per utente: chiudi l'eventuale socket precedente
    // (es. seconda tab, o riconnessione dopo perdita di rete su mobile).
    for (const ws of this.ctx.getWebSockets()) {
      const st = this.readState(ws);
      if (st?.uid === uid) {
        try {
          ws.close(4000, 'Sostituito da nuova connessione');
        } catch {
          // già chiuso
        }
      }
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Hibernation API: il runtime tiene vivo il socket anche se il DO
    // viene scaricato dalla memoria.
    this.ctx.acceptWebSocket(server);

    const occupied = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const st = this.readState(ws);
      if (st && st.uid !== uid) occupied.add(tileKey(st.x, st.y));
    }
    const spawn = findSpawnTile(occupied);

    const now = Date.now();
    const state: ConnState = {
      uid,
      usr,
      cs,
      x: spawn.x,
      y: spawn.y,
      lastActiveAt: now,
      lastMoveAt: 0,
      lastChatAt: 0,
      lastEmoteAt: 0,
    };
    server.serializeAttachment(state);

    // welcome al nuovo arrivato + user_joined agli altri
    const placements = await this.loadPlacements();
    const chat = ((await this.ctx.storage.get<ChatEntry[]>(CHAT_STORAGE_KEY)) ?? []).slice(
      -LIMITS.chatHistorySize,
    );
    // Bonus giornaliero: se già riscosso oggi ritorna null e leggiamo il
    // saldo a parte; altrimenti amount/balance arrivano già distinti.
    let dailyBonusAwarded: number | null = null;
    let balance: number;
    try {
      const daily = await awardDailyBonus(this.env.DB, uid);
      dailyBonusAwarded = daily?.amount ?? null;
      balance = daily?.balance ?? (await getBalance(this.env.DB, uid));
    } catch (e) {
      console.error('awardDailyBonus fallito', e);
      balance = await getBalance(this.env.DB, uid);
    }
    const dailyGoals = await getDailyGoalsState(this.env.DB, uid);

    this.send(server, {
      type: 'welcome',
      self: this.toRoomUser(state),
      users: this.listUsers(),
      chat,
      placements: [...placements.values()],
      balance,
      dailyGoals,
      dailyBonusAwarded,
    });
    this.broadcast({ type: 'user_joined', user: this.toRoomUser(state) }, server);

    // garantisce che il tick valuta sia armato finché c'è gente
    await this.ensureAlarm();

    // last_seen_at best-effort (non blocca il join se fallisce)
    try {
      await this.env.DB.prepare(`UPDATE users SET last_seen_at = unixepoch() WHERE id = ?1`)
        .bind(uid)
        .run();
    } catch (e) {
      console.error('last_seen_at update fallito', e);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  // -------------------------------------------------------------------------
  // Handler Hibernation API

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const state = this.readState(ws);
    if (!state) {
      ws.close(4001, 'Stato connessione perso');
      return;
    }

    const msg = parseClientMessage(raw);
    if (!msg) {
      this.send(ws, { type: 'error', code: 'invalid_message', message: 'Messaggio non valido' });
      return;
    }

    const now = Date.now();
    state.lastActiveAt = now;

    switch (msg.type) {
      case 'heartbeat':
        // solo aggiornamento lastActiveAt (già fatto sopra)
        break;

      case 'move': {
        // camminare implica alzarsi: niente conferma richiesta, come nella
        // realtà (ti alzi e basta se qualcuno ti chiama dall'altra parte).
        if (state.seatedOn) {
          state.seatedOn = undefined;
          this.broadcast({ type: 'user_stood', userId: state.uid });
        }
        if (now - state.lastMoveAt < LIMITS.moveMinIntervalMs) {
          // rate-limit silenzioso: il client legittimo non lo supera mai
          break;
        }
        const blocked = await this.placementTiles();
        if (!isInBounds(msg.targetX, msg.targetY) || !isWalkable(msg.targetX, msg.targetY, blocked)) {
          this.send(ws, {
            type: 'error',
            code: 'invalid_target',
            message: 'Non puoi camminare lì',
          });
          break;
        }
        state.lastMoveAt = now;
        state.x = msg.targetX;
        state.y = msg.targetY;
        this.broadcast({
          type: 'user_moved',
          userId: state.uid,
          targetX: msg.targetX,
          targetY: msg.targetY,
        });
        break;
      }

      case 'chat': {
        if (now - state.lastChatAt < LIMITS.chatMinIntervalMs) {
          this.send(ws, { type: 'error', code: 'rate_limited', message: 'Piano, un attimo!' });
          break;
        }
        // eslint-disable-next-line no-control-regex
        const text = msg.text.replace(/[\x00-\x1f\x7f]/g, '').trim();
        if (text.length === 0 || text.length > LIMITS.chatMaxLength) {
          this.send(ws, {
            type: 'error',
            code: 'invalid_message',
            message: `Messaggio vuoto o troppo lungo (max ${LIMITS.chatMaxLength})`,
          });
          break;
        }
        state.lastChatAt = now;
        const entry: ChatEntry = { userId: state.uid, username: state.usr, text, at: now };
        const history = ((await this.ctx.storage.get<ChatEntry[]>(CHAT_STORAGE_KEY)) ?? [])
          .concat(entry)
          .slice(-LIMITS.chatHistorySize);
        await this.ctx.storage.put(CHAT_STORAGE_KEY, history);
        this.broadcast({ type: 'chat', entry });
        await this.bumpGoalAndNotify(ws, state.uid, 'chat');
        break;
      }

      case 'place_item':
        await this.handlePlaceItem(ws, state, msg.inventoryId, msg.x, msg.y);
        break;

      case 'pickup_item':
        await this.handlePickupItem(ws, state, msg.inventoryId);
        break;

      case 'sit':
        await this.handleSit(ws, state, msg.inventoryId);
        break;

      case 'stand':
        this.handleStand(ws, state);
        break;

      case 'emote':
        await this.handleEmote(ws, state, msg.emote, now);
        break;
    }

    ws.serializeAttachment(state);
    await this.ensureAlarm();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const state = this.readState(ws);
    if (!state) return;
    // Se esiste un'ALTRA connessione per lo stesso utente (riconnessione
    // che ha sostituito questa), non annunciare l'uscita.
    const stillConnected = this.ctx
      .getWebSockets()
      .some((other) => other !== ws && this.readState(other)?.uid === state.uid);
    if (!stillConnected) {
      this.broadcast({ type: 'user_left', userId: state.uid }, ws);
      try {
        await this.env.DB.prepare(`UPDATE users SET last_seen_at = unixepoch() WHERE id = ?1`)
          .bind(state.uid)
          .run();
      } catch (e) {
        console.error('last_seen_at update fallito', e);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Valuta passiva: alarm periodico

  async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    if (sockets.length === 0) return; // bar vuoto: l'alarm non si riarma

    const now = Date.now();
    const credited = new Set<string>(); // paranoia anti doppio accredito
    for (const ws of sockets) {
      const state = this.readState(ws);
      if (!state || credited.has(state.uid)) continue;
      // anti-abuso base: niente accredito se idle (nessun heartbeat/azione
      // recente — il client manda heartbeat solo con tab in primo piano)
      if (now - state.lastActiveAt > CURRENCY.idleThresholdMs) continue;
      credited.add(state.uid);
      try {
        const balance = await creditCurrency(
          this.env.DB,
          state.uid,
          CURRENCY.earnAmount,
          TX_REASONS.passive,
        );
        this.send(ws, { type: 'currency_earned', amount: CURRENCY.earnAmount, balance });
        await this.bumpGoalAndNotify(ws, state.uid, 'presence');
      } catch (e) {
        console.error(`accredito passivo fallito per ${state.uid}`, e);
      }
    }

    // sync posizioni come correzione di deriva per client rimasti indietro
    this.broadcast({ type: 'state_sync', users: this.listUsers() });

    await this.ctx.storage.setAlarm(now + CURRENCY.earnIntervalMs);
  }

  private async ensureAlarm(): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null && this.ctx.getWebSockets().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + CURRENCY.earnIntervalMs);
    }
  }

  // -------------------------------------------------------------------------
  // Arredi

  private async handlePlaceItem(
    ws: WebSocket,
    state: ConnState,
    inventoryId: string,
    x: number,
    y: number,
  ): Promise<void> {
    const placements = await this.loadPlacements();

    if (!isInBounds(x, y) || !isWalkable(x, y, await this.placementTiles())) {
      this.send(ws, { type: 'error', code: 'tile_occupied', message: 'Tile non disponibile' });
      return;
    }
    // niente arredi sotto i piedi di qualcuno
    for (const other of this.ctx.getWebSockets()) {
      const st = this.readState(other);
      if (st && st.x === x && st.y === y) {
        this.send(ws, { type: 'error', code: 'tile_occupied', message: 'Tile occupata' });
        return;
      }
    }

    // ownership + stato verificati e aggiornati atomicamente su D1;
    // l'indice unico su (placed_x, placed_y) WHERE is_placed=1 protegge
    // dalla corsa tra due DO... non esiste: il DO è single-threaded, ma
    // protegge comunque da bug futuri.
    const row = await this.env.DB.prepare(
      `UPDATE inventory SET is_placed = 1, placed_x = ?1, placed_y = ?2
       WHERE id = ?3 AND user_id = ?4 AND is_placed = 0`,
    )
      .bind(x, y, inventoryId, state.uid)
      .run();

    if ((row.meta.changes ?? 0) === 0) {
      this.send(ws, {
        type: 'error',
        code: 'not_owner',
        message: 'Arredo non trovato nel tuo inventario (o già piazzato)',
      });
      return;
    }

    const info = await this.env.DB.prepare(
      `SELECT i.item_id, s.sprite_key, s.category FROM inventory i JOIN shop_items s ON s.id = i.item_id
       WHERE i.id = ?1`,
    )
      .bind(inventoryId)
      .first<{ item_id: string; sprite_key: string; category: string }>();

    const placement: Placement = {
      inventoryId,
      itemId: info?.item_id ?? 'sconosciuto',
      spriteKey: info?.sprite_key ?? 'sgabello',
      category: info?.category ?? 'decoro',
      ownerId: state.uid,
      x,
      y,
    };
    placements.set(inventoryId, placement);
    this.broadcast({ type: 'item_placed', placement });
  }

  private async handlePickupItem(
    ws: WebSocket,
    state: ConnState,
    inventoryId: string,
  ): Promise<void> {
    const row = await this.env.DB.prepare(
      `UPDATE inventory SET is_placed = 0, placed_x = NULL, placed_y = NULL
       WHERE id = ?1 AND user_id = ?2 AND is_placed = 1`,
    )
      .bind(inventoryId, state.uid)
      .run();
    if ((row.meta.changes ?? 0) === 0) {
      this.send(ws, {
        type: 'error',
        code: 'not_placed',
        message: 'Arredo non piazzato o non tuo',
      });
      return;
    }
    const placements = await this.loadPlacements();
    placements.delete(inventoryId);
    this.broadcast({ type: 'item_removed', inventoryId });

    // se qualcuno era seduto sull'arredo appena rimosso, alzalo
    for (const other of this.ctx.getWebSockets()) {
      const st = this.readState(other);
      if (st?.seatedOn === inventoryId) {
        st.seatedOn = undefined;
        other.serializeAttachment(st);
        this.broadcast({ type: 'user_stood', userId: st.uid });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Sedersi / alzarsi / emote / tris del giorno

  private async handleSit(ws: WebSocket, state: ConnState, inventoryId: string): Promise<void> {
    const placements = await this.loadPlacements();
    const seat = placements.get(inventoryId);
    if (!seat || seat.category !== 'seduta') {
      this.send(ws, { type: 'error', code: 'not_seat', message: 'Non ci si può sedere lì' });
      return;
    }
    const distance = Math.max(Math.abs(state.x - seat.x), Math.abs(state.y - seat.y));
    if (distance > LIMITS.sitMaxDistance) {
      this.send(ws, { type: 'error', code: 'too_far', message: 'Troppo lontano per sederti' });
      return;
    }
    for (const other of this.ctx.getWebSockets()) {
      const st = this.readState(other);
      if (st && st.uid !== state.uid && st.seatedOn === inventoryId) {
        this.send(ws, { type: 'error', code: 'seat_occupied', message: 'Posto occupato' });
        return;
      }
    }
    state.seatedOn = inventoryId;
    state.x = seat.x;
    state.y = seat.y;
    this.broadcast({ type: 'user_sat', userId: state.uid, inventoryId, x: seat.x, y: seat.y });
  }

  private handleStand(ws: WebSocket, state: ConnState): void {
    if (!state.seatedOn) {
      this.send(ws, { type: 'error', code: 'not_seated', message: 'Non sei seduto' });
      return;
    }
    state.seatedOn = undefined;
    this.broadcast({ type: 'user_stood', userId: state.uid });
  }

  private async handleEmote(
    ws: WebSocket,
    state: ConnState,
    emote: EmoteType,
    now: number,
  ): Promise<void> {
    if (now - state.lastEmoteAt < LIMITS.emoteMinIntervalMs) {
      this.send(ws, { type: 'error', code: 'rate_limited', message: 'Piano con le emote!' });
      return;
    }
    state.lastEmoteAt = now;
    this.broadcast({ type: 'emote', userId: state.uid, emote });
    if (emote === 'cheers') await this.awardBadgeAndNotify(ws, state.uid, 'primo_brindisi');
    await this.bumpGoalAndNotify(ws, state.uid, 'emote');
  }

  private async awardBadgeAndNotify(ws: WebSocket, userId: string, badgeId: string): Promise<void> {
    try {
      const badge = await awardBadge(this.env.DB, userId, badgeId);
      if (badge) {
        this.send(ws, { type: 'badge_earned', badgeId: badge.id, name: badge.name, icon: badge.icon });
      }
    } catch (e) {
      console.error(`awardBadge(${badgeId}) fallito per ${userId}`, e);
    }
  }

  /** Incrementa un contatore del tris del giorno e notifica SOLO il mittente. */
  private async bumpGoalAndNotify(
    ws: WebSocket,
    userId: string,
    kind: 'chat' | 'presence' | 'emote',
  ): Promise<void> {
    try {
      const { state: goals, awarded, balance } = await bumpDailyGoal(this.env.DB, userId, kind);
      this.send(ws, { type: 'daily_goals_update', goals, rewardAwarded: awarded, balance });
      if (awarded !== null) await this.awardBadgeAndNotify(ws, userId, 'prima_serata');
    } catch (e) {
      console.error(`bumpDailyGoal(${kind}) fallito per ${userId}`, e);
    }
  }

  /** Cache degli arredi piazzati; dopo l'ibernazione si ricarica da D1. */
  private async loadPlacements(): Promise<Map<string, Placement>> {
    if (this.placements) return this.placements;
    const rows = await this.env.DB.prepare(
      `SELECT i.id AS inventoryId, i.item_id AS itemId, s.sprite_key AS spriteKey,
              s.category AS category, i.user_id AS ownerId, i.placed_x AS x, i.placed_y AS y
       FROM inventory i JOIN shop_items s ON s.id = i.item_id
       WHERE i.is_placed = 1`,
    ).all<Placement>();
    this.placements = new Map(rows.results.map((p) => [p.inventoryId, p]));
    return this.placements;
  }

  private async placementTiles(): Promise<Set<string>> {
    const placements = await this.loadPlacements();
    const tiles = new Set<string>();
    for (const p of placements.values()) tiles.add(tileKey(p.x, p.y));
    return tiles;
  }

  // -------------------------------------------------------------------------
  // Utility

  private readState(ws: WebSocket): ConnState | null {
    try {
      return (ws.deserializeAttachment() as ConnState) ?? null;
    } catch {
      return null;
    }
  }

  private toRoomUser(s: ConnState): RoomUser {
    return {
      id: s.uid,
      username: s.usr,
      x: s.x,
      y: s.y,
      colorScheme: s.cs,
      ...(s.seatedOn ? { seatedOn: s.seatedOn } : {}),
    };
  }

  private listUsers(): RoomUser[] {
    const users: RoomUser[] = [];
    const seen = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const st = this.readState(ws);
      if (st && !seen.has(st.uid)) {
        seen.add(st.uid);
        users.push(this.toRoomUser(st));
      }
    }
    return users;
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // socket già chiuso: il runtime genererà webSocketClose
    }
  }

  private broadcast(msg: ServerMessage, except?: WebSocket): void {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(data);
      } catch {
        // ignora socket morti
      }
    }
  }
}
