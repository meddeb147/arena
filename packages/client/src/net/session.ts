import type { GameId, PlayerInput, Snapshot } from '@arena/shared';

/**
 * The client's view of a game. Step 1 ships `LocalSession` (the authoritative
 * engine running in the browser, used for offline play and landing-page
 * previews). Step 2 adds `NetSession` over WebSocket with the same interface,
 * so the renderer and HUD never know the difference.
 */
export interface GameSession {
  readonly gameId: GameId;
  /** Advance local time; may produce snapshots. */
  update(nowMs: number): void;
  sendInput(input: PlayerInput): void;
  requestSpawn(): void;
  /** Called for every snapshot together with the local time it became valid. */
  onSnapshot: ((snap: Snapshot, atMs: number) => void) | null;
  /** Free play-credit refill when broke (play credits only). */
  refill(): void;
  dispose(): void;
}
