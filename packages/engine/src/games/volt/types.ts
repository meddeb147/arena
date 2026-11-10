import type { BaseEntity } from '../../types';

export interface VoltFighter extends BaseEntity {
  hp: number;
  jabCd: number;
  punchTicks: number;
  dashX: number;
  dashY: number;
  /** fighters already hit by the current dash */
  dashHit: number[];
  /** knockback velocity, kept apart from steering so it isn't cancelled */
  kvx: number;
  kvy: number;
  zapCd: number;
  lastDamagedTick: number;
}

export interface Strike {
  id: number;
  x: number;
  y: number;
  r: number;
  fireTick: number;
}

export interface Pylon {
  id: number;
  x: number;
  y: number;
  r: number;
}

export interface Orb {
  id: number;
  x: number;
  y: number;
}

export interface VoltState {
  strikes: Strike[];
  pylons: Pylon[];
  orbs: Orb[];
  nextStrike: number;
  nextOrb: number;
}

export interface VoltBrain {
  nextThink: number;
  out: { dx: number; dy: number; skill1: boolean; skill2: boolean; cashout: boolean };
  wander: number;
}
