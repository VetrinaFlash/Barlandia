-- Barlandia — schema completo Fase 1 + Fase 2 (parziale)
-- Migration iniziale per D1 (database: barlandia-db)

-- ---------------------------------------------------------------------------
-- FASE 1: utenti e avatar

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at  INTEGER
);

CREATE TABLE avatar_config (
  user_id      TEXT PRIMARY KEY REFERENCES users(id),
  body         TEXT NOT NULL DEFAULT 'base',
  hair         TEXT NOT NULL DEFAULT 'corti',
  top          TEXT NOT NULL DEFAULT 'tshirt',
  bottom       TEXT NOT NULL DEFAULT 'jeans',
  color_scheme TEXT NOT NULL DEFAULT 'terracotta'
);

-- ---------------------------------------------------------------------------
-- FASE 2 (parziale): valuta e shop
-- NOTA: niente trading tra utenti in questa fase (vedi README).

CREATE TABLE wallets (
  user_id    TEXT PRIMARY KEY REFERENCES users(id),
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE shop_items (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  price      INTEGER NOT NULL CHECK (price >= 0),
  sprite_key TEXT NOT NULL,
  category   TEXT NOT NULL
);

CREATE TABLE inventory (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  item_id     TEXT NOT NULL REFERENCES shop_items(id),
  acquired_at INTEGER NOT NULL DEFAULT (unixepoch()),
  placed_x    INTEGER,
  placed_y    INTEGER,
  is_placed   INTEGER NOT NULL DEFAULT 0
);

-- Log append-only: MAI aggiornare o cancellare righe esistenti.
-- Ogni variazione di wallets.balance deve avere una riga qui
-- (vedi packages/shared/src/currency.ts, unico punto di scrittura).
CREATE TABLE currency_transactions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_inventory_user   ON inventory(user_id);
CREATE INDEX idx_inventory_placed ON inventory(is_placed) WHERE is_placed = 1;
CREATE INDEX idx_tx_user          ON currency_transactions(user_id, created_at);

-- Una sola cosa per tile: impedisce a livello di schema due arredi
-- piazzati sulla stessa casella.
CREATE UNIQUE INDEX idx_inventory_tile
  ON inventory(placed_x, placed_y) WHERE is_placed = 1;
