-- Sprint 2 (game design roadmap): amici con presenza + badge/profilo.
-- Vedi docs/GAME-DESIGN.md. NIENTE trasferimento di valuta tra utenti
-- qui ("offrigli un caffè" è trading P2P, resta fuori scope insieme al
-- resto del trading fino alla fase di audit dedicata).

-- Una riga per coppia di utenti, ordinata canonicamente (user_a < user_b)
-- così non serve gestire due righe speculari per la stessa amicizia.
CREATE TABLE friendships (
  user_a       TEXT NOT NULL REFERENCES users(id),
  user_b       TEXT NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted'
  requested_by TEXT NOT NULL REFERENCES users(id),
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE INDEX idx_friendships_b ON friendships(user_b);

CREATE TABLE badges (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL -- emoji placeholder, coerente con lo stile arredi/emote
);

CREATE TABLE user_badges (
  user_id   TEXT NOT NULL REFERENCES users(id),
  badge_id  TEXT NOT NULL REFERENCES badges(id),
  earned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, badge_id)
);

INSERT INTO badges (id, name, description, icon) VALUES
  ('primi_100', 'Uno dei primi', 'Tra i primi 100 avventori di Barlandia', '🌟'),
  ('prima_serata', 'Prima serata', 'Hai completato il tuo primo tris del giorno', '🌙'),
  ('primo_brindisi', 'Primo brindisi', 'Hai fatto il tuo primo brindisi al bar', '🥂');
