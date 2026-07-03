-- Sprint 1 (game design roadmap): bonus di benvenuto giornaliero e
-- "tris del giorno" — vedi docs/GAME-DESIGN.md.

-- Un claim per utente per giorno: l'INSERT OR IGNORE con questa PK
-- rende l'accredito del bonus atomico e senza race (vedi
-- packages/shared/src/currency.ts, awardDailyBonus).
CREATE TABLE daily_bonus_claims (
  user_id    TEXT NOT NULL REFERENCES users(id),
  claim_date TEXT NOT NULL, -- 'YYYY-MM-DD' (UTC)
  PRIMARY KEY (user_id, claim_date)
);

-- Tre obiettivi leggeri al giorno (1 sociale, 1 di presenza, 1 libero).
-- I contatori si incrementano con UPDATE atomici (ON CONFLICT DO UPDATE
-- SET x = x + 1), mai con read-then-write lato applicazione.
CREATE TABLE daily_goals (
  user_id        TEXT NOT NULL REFERENCES users(id),
  goal_date      TEXT NOT NULL,
  chat_count     INTEGER NOT NULL DEFAULT 0,
  presence_ticks INTEGER NOT NULL DEFAULT 0,
  emote_count    INTEGER NOT NULL DEFAULT 0,
  reward_claimed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, goal_date)
);
