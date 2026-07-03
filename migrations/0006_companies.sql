-- Sprint 6 (game design roadmap): Compagnie (gruppi ufficiali) — voce 35.
-- Puramente sociale: nome, stemma, motto, elenco membri. NIENTE valuta
-- condivisa o trasferimenti tra membri (stessa linea già tracciata per
-- amici/badge — vedi README).

CREATE TABLE companies (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  emblem     TEXT NOT NULL,
  motto      TEXT NOT NULL DEFAULT '',
  founder_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- UNIQUE su user_id: un utente appartiene al più a una compagnia alla volta.
CREATE TABLE company_members (
  company_id TEXT NOT NULL REFERENCES companies(id),
  user_id    TEXT NOT NULL UNIQUE REFERENCES users(id),
  role       TEXT NOT NULL DEFAULT 'membro', -- 'fondatore' | 'membro'
  joined_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (company_id, user_id)
);

CREATE INDEX idx_company_members_company ON company_members(company_id);

CREATE TABLE company_invites (
  company_id TEXT NOT NULL REFERENCES companies(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  invited_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (company_id, user_id)
);

CREATE INDEX idx_company_invites_user ON company_invites(user_id);
