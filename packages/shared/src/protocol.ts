/**
 * Protocollo WebSocket client <-> RoomDO.
 * Ogni messaggio è un singolo oggetto JSON con campo `type`.
 * Il server valida SEMPRE ogni campo: coordinate, lunghezze, rate.
 */

import { EMOTES, type EmoteType } from './constants';
import type { TilePos } from './room';

// ---------------------------------------------------------------------------
// Stato condiviso

export interface RoomUser {
  id: string;
  username: string;
  x: number;
  y: number;
  colorScheme: string;
  /** inventoryId del posto su cui è seduto, se seduto. */
  seatedOn?: string;
}

export interface ChatEntry {
  userId: string;
  username: string;
  text: string;
  /** epoch ms, assegnato dal server */
  at: number;
}

export interface Placement {
  /** id riga inventory */
  inventoryId: string;
  itemId: string;
  spriteKey: string;
  /** categoria da shop_items (es. 'seduta' → ci si può sedere). */
  category: string;
  ownerId: string;
  x: number;
  y: number;
}

export interface DailyGoalsSnapshot {
  chatCount: number;
  presenceTicks: number;
  emoteCount: number;
  rewardClaimed: boolean;
  chatTarget: number;
  presenceTarget: number;
  emoteTarget: number;
}

// ---------------------------------------------------------------------------
// Client -> Server

export interface MoveMessage {
  type: 'move';
  targetX: number;
  targetY: number;
}

export interface ChatMessage {
  type: 'chat';
  text: string;
}

/** Inviato solo con tab visibile: segnala presenza attiva (guadagno passivo). */
export interface HeartbeatMessage {
  type: 'heartbeat';
}

export interface PlaceItemMessage {
  type: 'place_item';
  inventoryId: string;
  x: number;
  y: number;
}

/** Rimuove un proprio arredo piazzato (torna in inventario). */
export interface PickupItemMessage {
  type: 'pickup_item';
  inventoryId: string;
}

/** Sedersi su un arredo piazzato di categoria 'seduta', se libero e vicino. */
export interface SitMessage {
  type: 'sit';
  inventoryId: string;
}

export interface StandMessage {
  type: 'stand';
}

export interface EmoteMessage {
  type: 'emote';
  emote: EmoteType;
}

export type ClientMessage =
  | MoveMessage
  | ChatMessage
  | HeartbeatMessage
  | PlaceItemMessage
  | PickupItemMessage
  | SitMessage
  | StandMessage
  | EmoteMessage;

// ---------------------------------------------------------------------------
// Server -> Client

/** Primo messaggio dopo la connessione: stato completo della stanza. */
export interface WelcomeMessage {
  type: 'welcome';
  self: RoomUser;
  users: RoomUser[];
  chat: ChatEntry[];
  placements: Placement[];
  balance: number;
  dailyGoals: DailyGoalsSnapshot;
  /** Importo del bonus giornaliero appena accreditato, se è il primo ingresso di oggi. */
  dailyBonusAwarded: number | null;
  /** XP totale del livello "Habitué" (voce 23 di GAME-DESIGN.md); il client deriva livello/titolo con levelForXp. */
  xp: number;
}

export interface StateSyncMessage {
  type: 'state_sync';
  users: RoomUser[];
}

export interface UserJoinedMessage {
  type: 'user_joined';
  user: RoomUser;
}

export interface UserLeftMessage {
  type: 'user_left';
  userId: string;
}

export interface UserMovedMessage {
  type: 'user_moved';
  userId: string;
  /** Destinazione validata; i client animano il percorso localmente. */
  targetX: number;
  targetY: number;
}

export interface ChatBroadcastMessage {
  type: 'chat';
  entry: ChatEntry;
}

export interface ItemPlacedMessage {
  type: 'item_placed';
  placement: Placement;
}

export interface ItemRemovedMessage {
  type: 'item_removed';
  inventoryId: string;
}

/** Accredito del guadagno passivo: nuovo saldo autoritativo. */
export interface CurrencyEarnedMessage {
  type: 'currency_earned';
  amount: number;
  balance: number;
}

export interface UserSatMessage {
  type: 'user_sat';
  userId: string;
  inventoryId: string;
  x: number;
  y: number;
}

export interface UserStoodMessage {
  type: 'user_stood';
  userId: string;
}

/** Broadcast a tutta la stanza: qualcuno ha fatto un'emote. */
export interface EmoteBroadcastMessage {
  type: 'emote';
  userId: string;
  emote: EmoteType;
}

/** Aggiornamento del tris del giorno del destinatario (mai broadcast). */
export interface DailyGoalsUpdateMessage {
  type: 'daily_goals_update';
  goals: DailyGoalsSnapshot;
  /** Importo appena accreditato se il tris è stato appena completato. */
  rewardAwarded: number | null;
  /** Nuovo saldo, presente solo se rewardAwarded non è null. */
  balance: number | null;
}

/** Un badge appena guadagnato (mai broadcast: solo a chi lo ha ottenuto). */
export interface BadgeEarnedMessage {
  type: 'badge_earned';
  badgeId: string;
  name: string;
  icon: string;
}

/** XP guadagnata (mai broadcast: solo a chi l'ha ottenuta). */
export interface XpEarnedMessage {
  type: 'xp_earned';
  amount: number;
  totalXp: number;
  leveledUp: boolean;
}

export interface ErrorMessage {
  type: 'error';
  code:
    | 'invalid_message'
    | 'invalid_target'
    | 'rate_limited'
    | 'not_owner'
    | 'tile_occupied'
    | 'already_placed'
    | 'not_placed'
    | 'not_seat'
    | 'seat_occupied'
    | 'too_far'
    | 'not_seated'
    | 'internal';
  message: string;
}

export type ServerMessage =
  | WelcomeMessage
  | StateSyncMessage
  | UserJoinedMessage
  | UserLeftMessage
  | UserMovedMessage
  | ChatBroadcastMessage
  | ItemPlacedMessage
  | ItemRemovedMessage
  | CurrencyEarnedMessage
  | UserSatMessage
  | UserStoodMessage
  | EmoteBroadcastMessage
  | DailyGoalsUpdateMessage
  | BadgeEarnedMessage
  | XpEarnedMessage
  | ErrorMessage;

// ---------------------------------------------------------------------------
// Parsing difensivo lato server

const MAX_RAW_MESSAGE_BYTES = 4096;

/**
 * Parsa e valida strutturalmente un messaggio client.
 * Ritorna null se il messaggio non è riconosciuto/malformato.
 * (La validazione semantica — percorribilità, ownership — resta al DO.)
 */
export function parseClientMessage(raw: string | ArrayBuffer): ClientMessage | null {
  if (typeof raw !== 'string') return null;
  if (raw.length > MAX_RAW_MESSAGE_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;
  switch (msg.type) {
    case 'move': {
      if (!Number.isInteger(msg.targetX) || !Number.isInteger(msg.targetY)) return null;
      return { type: 'move', targetX: msg.targetX as number, targetY: msg.targetY as number };
    }
    case 'chat': {
      if (typeof msg.text !== 'string') return null;
      return { type: 'chat', text: msg.text };
    }
    case 'heartbeat':
      return { type: 'heartbeat' };
    case 'place_item': {
      if (typeof msg.inventoryId !== 'string' || msg.inventoryId.length > 64) return null;
      if (!Number.isInteger(msg.x) || !Number.isInteger(msg.y)) return null;
      return {
        type: 'place_item',
        inventoryId: msg.inventoryId,
        x: msg.x as number,
        y: msg.y as number,
      };
    }
    case 'pickup_item': {
      if (typeof msg.inventoryId !== 'string' || msg.inventoryId.length > 64) return null;
      return { type: 'pickup_item', inventoryId: msg.inventoryId };
    }
    case 'sit': {
      if (typeof msg.inventoryId !== 'string' || msg.inventoryId.length > 64) return null;
      return { type: 'sit', inventoryId: msg.inventoryId };
    }
    case 'stand':
      return { type: 'stand' };
    case 'emote': {
      if (typeof msg.emote !== 'string' || !EMOTES.includes(msg.emote as EmoteType)) return null;
      return { type: 'emote', emote: msg.emote as EmoteType };
    }
    default:
      return null;
  }
}

export type { TilePos };
