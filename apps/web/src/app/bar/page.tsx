'use client';

/**
 * La stanza del bar: canvas PixiJS a schermo pieno + HUD minimale.
 * Collega BarEngine (vista) e RoomConnection (rete).
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMOTES,
  levelForXp,
  type ChatEntry,
  type DailyGoalsSnapshot,
  type EmoteType,
  type ServerMessage,
} from '@barlandia/shared';
import type { BarEngine } from '@/game/engine';
import type { RoomConnection } from '@/game/net';
import { isMuted, setMuted, sound } from '@/game/sound';
import {
  BachecaSheet,
  CartolinaSheet,
  ChatSheet,
  FriendsSheet,
  GoalsSheet,
  InventorySheet,
  ProfileSheet,
  ShopSheet,
  type InventoryItem,
  type ShopItem,
} from './sheets';

type OpenSheet =
  | null
  | 'chat'
  | 'shop'
  | 'inventory'
  | 'profile'
  | 'friends'
  | 'bacheca'
  | 'cartolina'
  | 'goals';

interface PlacementMode {
  inventoryId: string;
  name: string;
}

const EMOTE_EMOJI: Record<EmoteType, string> = {
  wave: '👋',
  cheers: '🥂',
  dance: '💃',
  clap: '👏',
};

export default function BarPage() {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BarEngine | null>(null);
  const connRef = useRef<RoomConnection | null>(null);
  const placementRef = useRef<PlacementMode | null>(null);
  const sheetRef = useRef<OpenSheet>(null);
  const selfIdRef = useRef('');

  const [username, setUsername] = useState('');
  const [colorScheme, setColorScheme] = useState('terracotta');
  const [balance, setBalance] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [sheet, setSheetState] = useState<OpenSheet>(null);
  const [placement, setPlacementState] = useState<PlacementMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [invRefresh, setInvRefresh] = useState(0);
  const [connStatus, setConnStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [seated, setSeated] = useState(false);
  const [dailyGoals, setDailyGoals] = useState<DailyGoalsSnapshot | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [xp, setXp] = useState(0);
  const [muted, setMutedState] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  function toggleMuted() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  const setSheet = useCallback((s: OpenSheet) => {
    sheetRef.current = s;
    setSheetState(s);
    if (s === 'chat') setUnread(0);
  }, []);

  const setPlacement = useCallback((p: PlacementMode | null) => {
    placementRef.current = p;
    setPlacementState(p);
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // bootstrap: sessione → engine → websocket
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const meRes = await fetch('/api/me');
      if (meRes.status === 401) {
        router.replace('/login');
        return;
      }
      const me = (await meRes.json()) as {
        user: { id: string; username: string; colorScheme: string };
        balance: number;
      };
      if (cancelled) return;
      setUsername(me.user.username);
      setColorScheme(me.user.colorScheme);
      setBalance(me.balance);
      selfIdRef.current = me.user.id;

      const { BarEngine } = await import('@/game/engine');
      const { RoomConnection } = await import('@/game/net');
      if (cancelled || !hostRef.current) return;

      const engine = new BarEngine({
        onTileTap: (x, y) => {
          const conn = connRef.current;
          if (!conn) return;
          const pm = placementRef.current;
          if (pm) {
            conn.send({ type: 'place_item', inventoryId: pm.inventoryId, x, y });
            setPlacement(null);
          } else {
            conn.send({ type: 'move', targetX: x, targetY: y });
          }
        },
        onSeatTap: (inventoryId) => {
          if (placementRef.current) return; // in modalità piazzamento non ci si siede
          connRef.current?.send({ type: 'sit', inventoryId });
        },
      });
      engineRef.current = engine;
      engine.setSelf(me.user.id);
      await engine.init(hostRef.current);
      if (cancelled) return;

      const conn = new RoomConnection({
        onStatus: (s) => {
          if (!cancelled) setConnStatus(s);
        },
        onMessage: (msg: ServerMessage) => {
          const eng = engineRef.current;
          if (!eng || cancelled) return;
          switch (msg.type) {
            case 'welcome':
              eng.setSelf(msg.self.id);
              eng.syncUsers([...msg.users.filter((u) => u.id !== msg.self.id), msg.self]);
              eng.setPlacements(msg.placements);
              setMessages(msg.chat);
              setBalance(msg.balance);
              setSeated(!!msg.self.seatedOn);
              setDailyGoals(msg.dailyGoals);
              setXp(msg.xp);
              setOnlineIds(new Set(msg.users.map((u) => u.id).concat(msg.self.id)));
              if (msg.dailyBonusAwarded !== null) {
                showToast(`Il caffè di oggi è offerto dalla casa: +${msg.dailyBonusAwarded} Chicchi ☕`);
              }
              break;
            case 'user_joined':
              eng.upsertUser(msg.user);
              setOnlineIds((prev) => new Set(prev).add(msg.user.id));
              break;
            case 'user_left':
              eng.removeUser(msg.userId);
              setOnlineIds((prev) => {
                const next = new Set(prev);
                next.delete(msg.userId);
                return next;
              });
              break;
            case 'user_moved':
              eng.walkUserTo(msg.userId, { x: msg.targetX, y: msg.targetY });
              break;
            case 'state_sync':
              eng.syncUsers(msg.users);
              setOnlineIds(new Set(msg.users.map((u) => u.id)));
              break;
            case 'chat':
              eng.showBubble(msg.entry.userId, msg.entry.text);
              setMessages((prev) => [...prev.slice(-99), msg.entry]);
              if (sheetRef.current !== 'chat') setUnread((n) => n + 1);
              if (msg.entry.userId !== selfIdRef.current) sound.chatReceived();
              break;
            case 'item_placed':
              eng.addPlacement(msg.placement);
              if (msg.placement.ownerId === selfIdRef.current) {
                setInvRefresh((n) => n + 1);
                showToast('Arredo piazzato!');
              }
              break;
            case 'item_removed':
              eng.removePlacement(msg.inventoryId);
              setInvRefresh((n) => n + 1);
              break;
            case 'currency_earned':
              setBalance(msg.balance);
              showToast(`+${msg.amount} Chicco per la tua presenza ☕`);
              sound.coinEarned();
              break;
            case 'user_sat':
              eng.setUserSeated(msg.userId, true, { x: msg.x, y: msg.y });
              if (msg.userId === selfIdRef.current) {
                setSeated(true);
                sound.sit();
              }
              break;
            case 'user_stood':
              eng.setUserSeated(msg.userId, false);
              if (msg.userId === selfIdRef.current) setSeated(false);
              break;
            case 'emote':
              eng.showEmote(msg.userId, EMOTE_EMOJI[msg.emote]);
              if (msg.userId !== selfIdRef.current) sound.emote();
              break;
            case 'daily_goals_update':
              setDailyGoals(msg.goals);
              if (msg.rewardAwarded !== null) {
                if (msg.balance !== null) setBalance(msg.balance);
                showToast(`Tris del giorno completato: +${msg.rewardAwarded} Chicchi 🎉`);
                sound.coinEarned();
              }
              break;
            case 'badge_earned':
              showToast(`Nuovo badge: ${msg.icon} ${msg.name}!`);
              sound.badgeEarned();
              break;
            case 'xp_earned':
              setXp(msg.totalXp);
              if (msg.leveledUp) {
                const { level, title } = levelForXp(msg.totalXp);
                showToast(`Sei salito al livello ${level}: ${title}! 🏅`);
                sound.levelUp();
              }
              break;
            case 'error':
              showToast(msg.message);
              sound.errorBeep();
              break;
          }
        },
      });
      connRef.current = conn;
      void conn.start();
    }

    void boot();
    return () => {
      cancelled = true;
      connRef.current?.stop();
      connRef.current = null;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [router, setPlacement, showToast]);

  async function onBuy(item: ShopItem) {
    const res = await fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id }),
    });
    const data = (await res.json()) as { balance?: number; message?: string };
    if (!res.ok) {
      showToast(data.message ?? 'Acquisto non riuscito');
      sound.errorBeep();
      return;
    }
    setBalance(data.balance ?? null);
    setInvRefresh((n) => n + 1);
    showToast(`${item.name} acquistato!`);
    sound.purchase();
  }

  function onPlaceRequest(item: InventoryItem) {
    setSheet(null);
    setPlacement({ inventoryId: item.id, name: item.name });
  }

  function onPickup(item: InventoryItem) {
    connRef.current?.send({ type: 'pickup_item', inventoryId: item.id });
    setSheet(null);
  }

  function sendChat(text: string) {
    connRef.current?.send({ type: 'chat', text });
    sound.chatSent();
  }

  function sendEmote(emote: EmoteType) {
    connRef.current?.send({ type: 'emote', emote });
    sound.emote();
  }

  function standUp() {
    connRef.current?.send({ type: 'stand' });
  }

  async function onColorChange(scheme: string) {
    const res = await fetch('/api/avatar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorScheme: scheme }),
    });
    if (!res.ok) {
      showToast('Cambio colore non riuscito');
      return;
    }
    setColorScheme(scheme);
    // il colore è firmato nel token rt: riconnettiamo per farlo arrivare
    // subito agli altri utenti (breve sparizione/riapparizione visibile)
    connRef.current?.stop();
    await connRef.current?.start();
  }

  async function logout() {
    if (!confirm('Vuoi uscire dal bar?')) return;
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <main className="bar-page">
      <div className="bar-canvas" ref={hostRef} />

      <div className="hud-top">
        <button className="hud-pill" onClick={logout} title="Esci">
          <span>{username || '…'}</span>
          {connStatus !== 'open' && <span style={{ opacity: 0.7 }}>· riconnessione…</span>}
        </button>
        <div className="hud-actions">
          <div className="hud-pill hud-balance">
            <span className="chicco">☕</span>
            <span>{balance ?? '–'}</span>
          </div>
          <div className="hud-pill" title={`${levelForXp(xp).title} — ${levelForXp(xp).xpIntoLevel} XP`}>
            🏅 Lv.{levelForXp(xp).level}
          </div>
          <button
            className="hud-btn hud-btn-icon"
            onClick={toggleMuted}
            title={muted ? 'Riattiva audio' : 'Disattiva audio'}
            aria-label={muted ? 'Riattiva audio' : 'Disattiva audio'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="hud-btn" onClick={() => setSheet('shop')}>
            Shop
          </button>
          <button className="hud-btn" onClick={() => setSheet('inventory')}>
            Zaino
          </button>
          <button className="hud-btn" onClick={() => setSheet('profile')}>
            Profilo
          </button>
          <button className="hud-btn" onClick={() => setSheet('friends')}>
            Amici
          </button>
          <button className="hud-btn" onClick={() => setSheet('bacheca')}>
            Bacheca
          </button>
          <button className="hud-btn" onClick={() => setSheet('cartolina')}>
            Cartolina
          </button>
          {dailyGoals && (
            <button className="hud-pill" onClick={() => setSheet('goals')}>
              🎯{' '}
              {[
                dailyGoals.chatCount >= dailyGoals.chatTarget,
                dailyGoals.presenceTicks >= dailyGoals.presenceTarget,
                dailyGoals.emoteCount >= dailyGoals.emoteTarget,
              ].filter(Boolean).length}
              /3
            </button>
          )}
        </div>
      </div>

      <div className="hud-bottom-actions">
        {EMOTES.map((e) => (
          <button
            key={e}
            className="emote-btn"
            onClick={() => sendEmote(e)}
            title={e}
            aria-label={`Emote ${e}`}
          >
            {EMOTE_EMOJI[e]}
          </button>
        ))}
        {seated && (
          <button className="hud-btn" onClick={standUp}>
            Alzati
          </button>
        )}
      </div>

      {placement && (
        <div className="placement-hint">
          <span>Tocca una casella libera per piazzare “{placement.name}”</span>
          <button onClick={() => setPlacement(null)}>Annulla</button>
        </div>
      )}

      {sheet === null && (
        <div className="chat-bar">
          <button className="chat-bar-open" onClick={() => setSheet('chat')}>
            Scrivi in chat…
            {unread > 0 && <span className="chat-unread">{unread}</span>}
          </button>
        </div>
      )}

      {sheet === 'chat' && (
        <ChatSheet
          messages={messages}
          selfId={selfIdRef.current}
          onSend={sendChat}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'shop' && (
        <ShopSheet balance={balance ?? 0} onBuy={onBuy} onClose={() => setSheet(null)} />
      )}
      {sheet === 'inventory' && (
        <InventorySheet
          onPlace={onPlaceRequest}
          onPickup={onPickup}
          onClose={() => setSheet(null)}
          refreshKey={invRefresh}
        />
      )}
      {sheet === 'profile' && (
        <ProfileSheet
          username={username}
          colorScheme={colorScheme}
          xp={xp}
          onColorChange={onColorChange}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'friends' && (
        <FriendsSheet onlineIds={onlineIds} onClose={() => setSheet(null)} />
      )}
      {sheet === 'goals' && (
        <GoalsSheet dailyGoals={dailyGoals} onClose={() => setSheet(null)} />
      )}
      {sheet === 'bacheca' && <BachecaSheet onClose={() => setSheet(null)} />}
      {sheet === 'cartolina' && (
        <CartolinaSheet username={username} onClose={() => setSheet(null)} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
