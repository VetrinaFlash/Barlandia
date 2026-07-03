'use client';

/** Bottom-sheet mobile-first: chat, shop, inventario, profilo, amici, bacheca, cartolina. */
import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  AVATAR_COLOR_SCHEMES,
  CURRENCY,
  levelForXp,
  type ChatEntry,
  type DailyGoalsSnapshot,
  type EventoGiorno,
} from '@barlandia/shared';
import { AVATAR_COLORS } from '@/game/palette';

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

/**
 * Anteprima di un arredo: STESSO disegno usato nella stanza (mai
 * un'emoji scollegata che può non assomigliare al render reale — vedi
 * game/preview.ts).
 */
function FurniturePreview({ spriteKey }: { spriteKey: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('@/game/preview')
      .then(({ renderFurniturePreview }) => renderFurniturePreview(spriteKey))
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch((e) => console.error('anteprima arredo fallita', spriteKey, e));
    return () => {
      cancelled = true;
    };
  }, [spriteKey]);

  return (
    <div className="shop-emoji">
      {src && <img src={src} alt="" className="shop-preview-img" />}
    </div>
  );
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-title">
          <span>{title}</span>
          <button className="sheet-close" onClick={onClose}>
            Chiudi ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

export function ChatSheet({
  messages,
  selfId,
  onSend,
  onClose,
}: {
  messages: ChatEntry[];
  selfId: string;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Chat">
        <div className="sheet-handle" />
        <div className="sheet-title">
          <span>Chat del bar</span>
          <button className="sheet-close" onClick={onClose}>
            Chiudi ✕
          </button>
        </div>
        <div className="sheet-body" ref={listRef}>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="inv-empty">Nessun messaggio: rompi il ghiaccio!</div>
            )}
            {messages.map((m, i) => (
              <div className="chat-msg" key={`${m.at}-${i}`}>
                <span
                  className="chat-author"
                  style={m.userId === selfId ? { color: 'var(--ottone)' } : undefined}
                >
                  {m.username}
                </span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
        </div>
        <form className="chat-input-row" onSubmit={submit}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Scrivi un messaggio…"
            maxLength={200}
            autoFocus
          />
          <button className="chat-send" type="submit">
            Invia
          </button>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  spriteKey: string;
  category: string;
}

export function ShopSheet({
  balance,
  onBuy,
  onClose,
}: {
  balance: number;
  onBuy: (item: ShopItem) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/shop/items')
      .then((r) => r.json() as Promise<{ items: ShopItem[] }>)
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, []);

  return (
    <Sheet title={`Shop · saldo ${balance} ☕`} onClose={onClose}>
      {items === null && <div className="inv-empty">Carico il catalogo…</div>}
      {items && (
        <div className="shop-grid">
          {items.map((item) => (
            <div className="shop-card" key={item.id}>
              <FurniturePreview spriteKey={item.spriteKey} />
              <div className="shop-name">{item.name}</div>
              <button
                className="shop-buy"
                disabled={busyId !== null || balance < item.price}
                onClick={async () => {
                  setBusyId(item.id);
                  try {
                    await onBuy(item);
                  } finally {
                    setBusyId(null);
                  }
                }}
              >
                {busyId === item.id ? '…' : `${item.price} Chicchi`}
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

export interface InventoryItem {
  id: string;
  itemId: string;
  name: string;
  spriteKey: string;
  category: string;
  isPlaced: number;
  placedX: number | null;
  placedY: number | null;
}

export function InventorySheet({
  onPlace,
  onPickup,
  onClose,
  refreshKey,
}: {
  onPlace: (item: InventoryItem) => void;
  onPickup: (item: InventoryItem) => void;
  onClose: () => void;
  refreshKey: number;
}) {
  const [items, setItems] = useState<InventoryItem[] | null>(null);

  useEffect(() => {
    fetch('/api/inventory')
      .then((r) => r.json() as Promise<{ items: InventoryItem[] }>)
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, [refreshKey]);

  return (
    <Sheet title="Il tuo inventario" onClose={onClose}>
      {items === null && <div className="inv-empty">Carico…</div>}
      {items && items.length === 0 && (
        <div className="inv-empty">
          Ancora niente: passa dallo shop e arreda il bar con i tuoi Chicchi ☕
        </div>
      )}
      {items && items.length > 0 && (
        <div className="shop-grid">
          {items.map((item) => (
            <div className="shop-card" key={item.id}>
              <FurniturePreview spriteKey={item.spriteKey} />
              <div className="shop-name">{item.name}</div>
              {item.isPlaced ? (
                <button className="shop-buy secondary" onClick={() => onPickup(item)}>
                  Ritira
                </button>
              ) : (
                <button className="shop-buy" onClick={() => onPlace(item)}>
                  Piazza
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
}

export function ProfileSheet({
  username,
  colorScheme,
  xp,
  onColorChange,
  onClose,
}: {
  username: string;
  colorScheme: string;
  xp: number;
  onColorChange: (scheme: string) => Promise<void>;
  onClose: () => void;
}) {
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [busy, setBusy] = useState(false);
  const level = levelForXp(xp);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json() as Promise<{ badges: Badge[] }>)
      .then((d) => setBadges(d.badges))
      .catch(() => setBadges([]));
  }, []);

  return (
    <Sheet title={`Profilo di ${username}`} onClose={onClose}>
      <div className="profile-section-title">Livello</div>
      <div className="level-block">
        <div className="level-badge">🏅 Lv.{level.level}</div>
        <div className="level-detail">
          <div className="level-title">{level.title}</div>
          {level.xpForNextLevel > 0 ? (
            <>
              <div className="level-bar">
                <div
                  className="level-bar-fill"
                  style={{ width: `${Math.min(100, (level.xpIntoLevel / level.xpForNextLevel) * 100)}%` }}
                />
              </div>
              <div className="level-xp-label">
                {level.xpIntoLevel} / {level.xpForNextLevel} XP al prossimo livello
              </div>
            </>
          ) : (
            <div className="level-xp-label">Livello massimo raggiunto ✨</div>
          )}
        </div>
      </div>

      <div className="profile-section-title">Colore avatar</div>
      <div className="color-picker">
        {AVATAR_COLOR_SCHEMES.map((scheme) => (
          <button
            key={scheme}
            className={`color-swatch${scheme === colorScheme ? ' active' : ''}`}
            style={{ background: hex(AVATAR_COLORS[scheme]?.body ?? 0xc65f3d) }}
            disabled={busy}
            aria-label={scheme}
            onClick={async () => {
              setBusy(true);
              try {
                await onColorChange(scheme);
              } finally {
                setBusy(false);
              }
            }}
          />
        ))}
      </div>

      <div className="profile-section-title">Badge</div>
      {badges === null && <div className="inv-empty">Carico…</div>}
      {badges && (
        <div className="badge-grid">
          {badges.map((b) => (
            <div className={`badge-card${b.earned ? '' : ' locked'}`} key={b.id} title={b.description}>
              <div className="badge-icon">{b.icon}</div>
              <div className="badge-name">{b.name}</div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

export interface Friend {
  id: string;
  username: string;
  colorScheme: string;
}

export function FriendsSheet({
  onlineIds,
  onClose,
}: {
  onlineIds: Set<string>;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ friends: Friend[]; incoming: Friend[]; outgoing: Friend[] } | null>(
    null,
  );
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    fetch('/api/friends')
      .then((r) => r.json() as Promise<{ friends: Friend[]; incoming: Friend[]; outgoing: Friend[] }>)
      .then(setData)
      .catch(() => setData({ friends: [], incoming: [], outgoing: [] }));
  }, [refresh]);

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (!u) return;
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u }),
    });
    const body = (await res.json()) as { message?: string; alreadyFriends?: boolean };
    if (!res.ok) {
      setMessage(body.message ?? 'Richiesta non riuscita');
    } else {
      setMessage(body.alreadyFriends ? 'Siete già amici' : `Richiesta inviata a ${u}`);
      setUsername('');
      setRefresh((n) => n + 1);
    }
  }

  async function respond(friendId: string) {
    await fetch('/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId }),
    });
    setRefresh((n) => n + 1);
  }

  async function remove(friendId: string) {
    await fetch('/api/friends/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId }),
    });
    setRefresh((n) => n + 1);
  }

  return (
    <Sheet title="Amici" onClose={onClose}>
      <form className="friend-add-row" onSubmit={sendRequest}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username da aggiungere…"
          maxLength={20}
        />
        <button className="shop-buy" type="submit">
          Aggiungi
        </button>
      </form>
      {message && <div className="inv-empty">{message}</div>}

      {data && data.incoming.length > 0 && (
        <>
          <div className="profile-section-title">Richieste ricevute</div>
          {data.incoming.map((f) => (
            <div className="friend-row" key={f.id}>
              <span>{f.username}</span>
              <div className="friend-row-actions">
                <button className="shop-buy" onClick={() => respond(f.id)}>
                  Accetta
                </button>
                <button className="shop-buy secondary" onClick={() => remove(f.id)}>
                  Rifiuta
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {data && data.outgoing.length > 0 && (
        <>
          <div className="profile-section-title">Richieste inviate</div>
          {data.outgoing.map((f) => (
            <div className="friend-row" key={f.id}>
              <span>{f.username}</span>
              <span className="friend-pending">in attesa…</span>
            </div>
          ))}
        </>
      )}

      <div className="profile-section-title">I tuoi amici</div>
      {data === null && <div className="inv-empty">Carico…</div>}
      {data && data.friends.length === 0 && (
        <div className="inv-empty">Nessun amico ancora: aggiungine uno per username!</div>
      )}
      {data &&
        data.friends.map((f) => (
          <div className="friend-row" key={f.id}>
            <span>
              <span className={`friend-dot${onlineIds.has(f.id) ? ' online' : ''}`} />
              {f.username}
            </span>
            <button className="shop-buy secondary" onClick={() => remove(f.id)}>
              Rimuovi
            </button>
          </div>
        ))}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

const GOAL_ROWS: { key: 'chatCount' | 'presenceTicks' | 'emoteCount'; targetKey: 'chatTarget' | 'presenceTarget' | 'emoteTarget'; icon: string; label: string }[] = [
  { key: 'chatCount', targetKey: 'chatTarget', icon: '💬', label: 'Manda messaggi in chat' },
  { key: 'presenceTicks', targetKey: 'presenceTarget', icon: '☕', label: 'Resta al bar' },
  { key: 'emoteCount', targetKey: 'emoteTarget', icon: '👋', label: 'Fai un’emote' },
];

/**
 * Sheet degli obiettivi ("tris del giorno"): mostra il progresso di
 * OGNI obiettivo con una barra, non solo quanti sono completi — prima
 * la HUD mostrava un'unica frazione "n/3" che restava a 0/3 finché il
 * primo obiettivo non era del tutto completo, dando l'impressione che
 * non stesse succedendo nulla (bug segnalato: "gli obiettivi non
 * funzionano"). `dailyGoals` arriva da page.tsx già live via WebSocket,
 * quindi le barre si muovono in tempo reale anche a sheet aperta.
 */
export function GoalsSheet({
  dailyGoals,
  onClose,
}: {
  dailyGoals: DailyGoalsSnapshot | null;
  onClose: () => void;
}) {
  return (
    <Sheet title="Obiettivi di oggi" onClose={onClose}>
      {dailyGoals === null && <div className="inv-empty">Carico…</div>}
      {dailyGoals && (
        <>
          <div className="goal-list">
            {GOAL_ROWS.map((row) => {
              const value = dailyGoals[row.key];
              const target = dailyGoals[row.targetKey];
              const done = value >= target;
              return (
                <div className="goal-row" key={row.key}>
                  <div className="goal-row-top">
                    <span className="goal-icon">{row.icon}</span>
                    <span className="goal-label">{row.label}</span>
                    <span className="goal-count">
                      {done ? '✓' : `${value}/${target}`}
                    </span>
                  </div>
                  <div className="level-bar">
                    <div
                      className="level-bar-fill"
                      style={{ width: `${Math.min(100, (value / target) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="goal-reward">
            {dailyGoals.rewardClaimed
              ? `Premio già riscosso oggi ✅ (+${CURRENCY.dailyGoalsReward} ${CURRENCY.name})`
              : `Completa tutti e tre gli obiettivi per +${CURRENCY.dailyGoalsReward} ${CURRENCY.name} 🎉`}
          </div>
        </>
      )}
    </Sheet>
  );
}

export function BachecaSheet({ onClose }: { onClose: () => void }) {
  const [oggi, setOggi] = useState<EventoGiorno | null>(null);

  useEffect(() => {
    fetch('/api/bacheca')
      .then((r) => r.json() as Promise<{ oggi: EventoGiorno }>)
      .then((d) => setOggi(d.oggi))
      .catch(() => setOggi(null));
  }, []);

  return (
    <Sheet title="Bacheca" onClose={onClose}>
      {oggi === null && <div className="inv-empty">Carico…</div>}
      {oggi && (
        <div className="event-card">
          <div className="event-format">{oggi.formato}</div>
          <div className="event-name">{oggi.nome}</div>
          <div className="event-goal">{oggi.obiettivo}</div>
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

interface Recap {
  balance: number;
  dailyGoals: DailyGoalsSnapshot;
  badgesToday: { id: string; name: string; icon: string }[];
  presenceMinutesApprox: number;
  oggi: EventoGiorno;
}

export function CartolinaSheet({ username, onClose }: { username: string; onClose: () => void }) {
  const [recap, setRecap] = useState<Recap | null>(null);

  useEffect(() => {
    fetch('/api/recap')
      .then((r) => r.json() as Promise<Recap>)
      .then(setRecap)
      .catch(() => setRecap(null));
  }, []);

  const goalsDone = recap
    ? [
        recap.dailyGoals.chatCount >= recap.dailyGoals.chatTarget,
        recap.dailyGoals.presenceTicks >= recap.dailyGoals.presenceTarget,
        recap.dailyGoals.emoteCount >= recap.dailyGoals.emoteTarget,
      ].filter(Boolean).length
    : 0;

  return (
    <Sheet title="La tua cartolina" onClose={onClose}>
      {recap === null && <div className="inv-empty">Carico…</div>}
      {recap && (
        <div className="postcard">
          <div className="postcard-title">☕ {username} al Barlandia</div>
          <div className="postcard-row">🕐 circa {recap.presenceMinutesApprox} min al bar oggi</div>
          <div className="postcard-row">
            🎯 {goalsDone}/3 obiettivi del tris di oggi
          </div>
          <div className="postcard-row">💰 {recap.balance} Chicchi in tasca</div>
          {recap.badgesToday.length > 0 && (
            <div className="postcard-row">
              🏅 Nuovo oggi: {recap.badgesToday.map((b) => `${b.icon} ${b.name}`).join(', ')}
            </div>
          )}
          <div className="postcard-footer">Stasera al bar: {recap.oggi.nome}</div>
          <div className="postcard-hint">Fai uno screenshot per condividerla con gli amici!</div>
        </div>
      )}
    </Sheet>
  );
}
