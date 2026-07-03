/**
 * Costanti condivise di Barlandia.
 * Il naming del progetto è sempre `barlandia` (slug) — vedi vincoli handoff.
 */

export const PROJECT_SLUG = 'barlandia';

/** Nome della stanza unica (Fase 1). */
export const ROOM_NAME = 'barlandia';

/** Valuta virtuale: "Chicchi" (chicchi di caffè — countable, coerente col tema bar). */
export const CURRENCY = {
  /** Nome visualizzato (plurale). */
  name: 'Chicchi',
  /** Nome singolare. */
  singular: 'Chicco',
  /** Quanto si guadagna per ogni intervallo di presenza attiva. */
  earnAmount: 1,
  /** Ogni quanto viene accreditato il guadagno passivo (ms). */
  earnIntervalMs: 5 * 60 * 1000,
  /**
   * Se non arriva attività (heartbeat/move/chat) entro questa soglia,
   * l'utente è considerato idle e NON viene accreditato.
   */
  idleThresholdMs: 2 * 60 * 1000,
  /** Bonus una tantum alla registrazione. */
  welcomeBonus: 50,
  /** Bonus giornaliero al primo ingresso del giorno ("il caffè offerto da Bruno"). */
  dailyBonusAmount: 5,
  /** Premio per aver completato il tris del giorno. */
  dailyGoalsReward: 10,
  /** Guadagno per intervallo mentre si è "al lavoro" a una postazione (vedi jobs.ts). */
  jobEarnAmount: 3,
} as const;

/** Motivi (reason) ammessi nel log currency_transactions. */
export const TX_REASONS = {
  welcome: 'bonus_benvenuto',
  passive: 'presenza_bar',
  purchase: 'acquisto_shop',
  daily: 'caffe_giornaliero',
  dailyGoals: 'tris_del_giorno',
  job: 'turno_lavoro',
} as const;

/** Tris del giorno: soglie per completare i 3 obiettivi leggeri. */
export const DAILY_GOALS = {
  chatTarget: 3,
  presenceTarget: 2,
  emoteTarget: 1,
} as const;

/** Emote disponibili (Sprint 1: nessuna richiesta/conferma, solo emote singole). */
export const EMOTES = ['wave', 'cheers', 'dance', 'clap'] as const;
export type EmoteType = (typeof EMOTES)[number];

/** Limiti di validazione lato server. */
export const LIMITS = {
  chatMaxLength: 200,
  chatHistorySize: 50,
  /** Minimo intervallo tra due messaggi chat dello stesso utente (ms). */
  chatMinIntervalMs: 500,
  /** Minimo intervallo tra due comandi move dello stesso utente (ms). */
  moveMinIntervalMs: 250,
  /** Minimo intervallo tra due emote dello stesso utente (ms). */
  emoteMinIntervalMs: 1500,
  /** Distanza massima (in tile, Chebyshev) per sedersi su un posto. */
  sitMaxDistance: 1,
  /** Durata massima di un turno di lavoro: dopo, si viene "timbrati" fuori in automatico. */
  maxShiftMs: 15 * 60 * 1000,
  usernameMin: 3,
  usernameMax: 20,
  passwordMin: 8,
} as const;

/** Durate sessione/token. */
export const AUTH = {
  sessionCookieName: 'barlandia_session',
  sessionTtlSeconds: 30 * 24 * 60 * 60, // 30 giorni
  /** Token per il collegamento WS al worker realtime: monouso di fatto, vita breve. */
  rtTokenTtlSeconds: 60,
} as const;

/** Heartbeat lato client (solo con tab visibile). */
export const HEARTBEAT_INTERVAL_MS = 45 * 1000;

/** Schemi colore disponibili per gli avatar (palette caffè vintage). */
export const AVATAR_COLOR_SCHEMES = [
  'terracotta',
  'ottone',
  'salvia',
  'espresso',
  'cielo',
  'vinaccia',
] as const;
export type AvatarColorScheme = (typeof AVATAR_COLOR_SCHEMES)[number];

/** Vestiario disponibile per l'avatar (colonna `top` di avatar_config, riusata). */
export const AVATAR_OUTFITS = ['maglia', 'gilet', 'papillon', 'grembiule'] as const;
export type AvatarOutfit = (typeof AVATAR_OUTFITS)[number];

/**
 * Normalizza un valore letto da `avatar_config.top`: la colonna esiste
 * da prima del vestiario vero e proprio con DEFAULT 'tshirt', quindi
 * righe create prima di questa feature hanno un valore che non è più
 * tra le chiavi valide — ricadono sulla maglia di base invece di rompere
 * il rendering.
 */
export function normalizeOutfit(value: string | null | undefined): AvatarOutfit {
  return AVATAR_OUTFITS.includes(value as AvatarOutfit) ? (value as AvatarOutfit) : 'maglia';
}
