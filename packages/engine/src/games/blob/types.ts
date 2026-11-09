import type { BaseEntity } from '../../types';
import type { SpatialGrid } from '../../spatial';

export interface BlobCell extends BaseEntity {
  mass: number;
  dashX: number;
  dashY: number;
}

export interface Pellet {
  id: number;
  x: number;
  y: number;
  mass: number;
  /** palette index (renderer picks the colour) */
  hue: number;
  /** ejected mass drifts until it stops */
  vx: number;
  vy: number;
}

export interface Trap {
  id: number;
  x: number;
  y: number;
  r: number;
  /** spin angle */
  a: number;
  spin: number;
  /** slow orbit around an anchor so traps are not static */
  cx: number;
  cy: number;
  orbitR: number;
  orbitSpeed: number;
  phase: number;
}

export interface BlobState {
  pellets: Map<number, Pellet>;
  grid: SpatialGrid<Pellet>;
  /** pellets that are still drifting */
  moving: Set<Pellet>;
  traps: Trap[];
}

export interface BlobBrain {
  nextThink: number;
  out: { dx: number; dy: number; skill1: boolean; skill2: boolean; cashout: boolean };
  wander: number;
}
