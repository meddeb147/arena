import type { GameId, PlayerInput, Snapshot } from '@arena/shared';

export type SessionStatus = 'connecting' | 'online' | 'offline' | 'closed';

/**
 * The client's view of a game: `LocalSession` (engine in the browser, bots
 * only) or `NetSession` (authoritative server over WebSocket). The renderer and
 * HUD never know the difference.
 */
export interface GameSession {
  readonly gameId: GameId;
  /** how far in the past to render, to smooth over snapshot gaps */
  readonly interpDelayMs: number;
  status: SessionStatus;
  /** Advance local time; may produce snapshots. */
  update(nowMs: number): void;
  sendInput(input: PlayerInput): void;
  requestSpawn(): void;
  /** Called for every snapshot together with the local time it became valid. */
  onSnapshot: ((snap: Snapshot, atMs: number) => void) | null;
  onStatus: ((s: SessionStatus) => void) | null;
  /** Free play-credit refill when broke (play credits only). */
  refill(): void;
  dispose(): void;
}
