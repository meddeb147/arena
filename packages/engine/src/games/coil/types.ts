import type { BaseEntity } from '../../types';
import type { SpatialGrid } from '../../spatial';

export interface Snake extends BaseEntity {
  mass: number;
  /** body points, head first: [x0, y0, x1, y1, …] */
  body: number[];
  /** distance travelled since the last recorded point */
  sinceLast: number;
}

export interface CoilPellet {
  id: number;
  x: number;
  y: number;
  mass: number;
  hue: number;
  golden: boolean;
}

export interface CoilTrap {
  id: number;
  x: number;
  y: number;
  r: number;
  a: number;
  spin: number;
}

export interface CoilState {
  pellets: Map<number, CoilPellet>;
  grid: SpatialGrid<CoilPellet>;
  traps: CoilTrap[];
}

export interface CoilBrain {
  nextThink: number;
  out: { dx: number; dy: number; skill1: boolean; skill2: boolean; cashout: boolean };
  wander: number;
}
