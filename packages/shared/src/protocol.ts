import type { EntitySnap, GameEvent, GameId, LeaderboardRow, SelfState } from './types';

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
  | { t: 'hello'; v: number; game: GameId; name: string; guestId: string }
  | { t: 'in'; seq: number; dx: number; dy: number; s1: 0 | 1; s2: 0 | 1; co: 0 | 1 }
  | { t: 'spawn' }
  | { t: 'refill' }
  | { t: 'ping'; c: number };

export type ServerMsg =
  | { t: 'welcome'; playerId: string; roomId: string; game: GameId; world: { w: number; h: number }; tickRate: number }
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
    }
  | { t: 'err'; code: 'version' | 'full' | 'bad_game' | 'rate' | 'replaced'; msg?: string }
  | { t: 'pong'; c: number; s: number };

/** Nicknames: printable, trimmed, max 16 chars. */
export function cleanName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  // strip control characters and bidi overrides that could garble the leaderboard
  const cleaned = s.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, '').trim();
  return cleaned.slice(0, 16);
}
