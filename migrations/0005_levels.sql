-- Sprint 4 (game design roadmap): livelli "Habitué" — vedi docs/GAME-DESIGN.md,
-- voce 23. XP guadagnata SOLO da presenza attiva ed eventi (tris del giorno,
-- badge), MAI dalla spesa: un livello racconta quanto sei stato al bar, non
-- quanti Chicchi hai bruciato in arredi.

CREATE TABLE user_xp (
  user_id    TEXT PRIMARY KEY REFERENCES users(id),
  xp         INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Cap giornaliero di XP: senza questo, chi resta collegato H24 supera chi
-- si presenta ogni sera per un'oretta, il contrario di quello che un
-- livello "Habitué" dovrebbe premiare.
CREATE TABLE daily_xp_gains (
  user_id   TEXT NOT NULL REFERENCES users(id),
  gain_date TEXT NOT NULL, -- 'YYYY-MM-DD' (UTC)
  amount    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, gain_date)
);
