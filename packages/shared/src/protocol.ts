import type { EntitySnap, GameEvent, GameId, KingInfo, LeaderboardRow, SelfState } from './types';

/**
 * Wire protocol (JSON over WebSocket at /ws).
 * Clients only ever send intentions; the server decides everything.
 */
export const PROTOCOL_VERSION = 1;
export const WS_PATH = '/ws';
/** Snapshots go out every N simulation ticks (30 Hz / 2 = 15 Hz). */
export const SNAPSHOT_EVERY_TICKS = 2;
/** Hard caps enforced by the server. */
export const MAX_MESSAGE_BYTES = 1024;
export const MAX_MESSAGES_PER_SECOND = 60;

export type ClientMsg =
  | { t: 'hello'; v: number; game: GameId; name: string; guestId: string; room?: string }
  | { t: 'in'; seq: number; dx: number; dy: number; s1: 0 | 1; s2: 0 | 1; co: 0 | 1 }
  | { t: 'spawn' }
  | { t: 'refill' }
  | { t: 'ping'; c: number };

export type ServerMsg =
  | { t: 'welcome'; playerId: string; roomId: string; game: GameId; world: { w: number; h: number }; tickRate: number; code?: string }
  | {
      t: 's';
      tick: number;
      /** entities that are new or changed since the last snapshot sent to this client */
      u: EntitySnap[];
      /** ids that left this client's view */
      d: number[];
      lb: LeaderboardRow[];
      ev: GameEvent[];
      you: SelfState;
      pop: { humans: number; bots: number };
      king: KingInfo | null;
    }
  | { t: 'err'; code: 'version' | 'full' | 'bad_game' | 'rate' | 'replaced'; msg?: string }
  | { t: 'pong'; c: number; s: number };

/**
 * Word stems that are never allowed in a nickname (EN/FR/AR basics). Not
 * exhaustive: it catches the obvious cases portals and players complain about.
 */
const BANNED = [
  'fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'porn', 'dick', 'cock', 'pussy', 'asshole', 'retard',
  'putain', 'salope', 'encule', 'connard', 'pute', 'merde', 'batard', 'nique',
  'كس', 'زب', 'شرموط', 'قحب', 'منيوك', 'خول', 'نيك',
];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

/** True if the name contains a banned word, also through l33t-speak, spacing and punctuation. */
export function isOffensive(name: string): boolean {
  const norm = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^\p{L}]/gu, '');
  return BANNED.some((w) => norm.includes(w));
}

/** Nicknames: printable, trimmed, max 16 chars, no slurs (replaced by a neutral name). */
export function cleanName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  // strip control characters and bidi overrides that could garble the leaderboard
  const cleaned = s.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, '').trim().slice(0, 16);
  if (cleaned && isOffensive(cleaned)) return 'Player';
  return cleaned;
}

/** Private room codes: 5 letters/digits, unambiguous characters only. */
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
