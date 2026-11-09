import type { EntitySnap, GameId, Snapshot } from '@arena/shared';
import type { Stage } from '../render/stage';

/** Client-side half of a game module: turns snapshots into pixels. */
export interface GameRenderer {
  readonly gameId: GameId;
  /** Draw static scenery (background, world bounds). */
  init(stage: Stage, world: { w: number; h: number }): void;
  /** Draw interpolated entities. Called every animation frame. */
  render(ents: EntitySnap[], snap: Snapshot, timeMs: number, dtMs: number): void;
  /** React to authoritative events (explosions, sounds…). Called once per snapshot. */
  onSnapshot(snap: Snapshot): void;
  /** Size the camera should follow for the local player. */
  focusSize(ent: EntitySnap): number;
  destroy(): void;
}
