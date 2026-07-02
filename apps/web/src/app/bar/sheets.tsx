'use client';

/** Bottom-sheet mobile-first: chat, shop e inventario. */
import { FormEvent, useEffect, useRef, useState } from 'react';
import type { ChatEntry } from '@barlandia/shared';
import { SPRITE_EMOJI } from '@/game/sprites';

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
              <div className="shop-emoji">{SPRITE_EMOJI[item.spriteKey] ?? '📦'}</div>
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
              <div className="shop-emoji">{SPRITE_EMOJI[item.spriteKey] ?? '📦'}</div>
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
