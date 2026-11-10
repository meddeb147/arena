import type { BaseEntity } from '../../types';

export interface Wrestler extends BaseEntity {
  ramX: number;
  ramY: number;
  /** ticks spent off the edge (falling) */
  falling: number;
}

export interface SumoState {
  bumpers: { id: number; x: number; y: number; r: number }[];
  platformId: number;
  radius: number;
  lastSnap: boolean;
}

export interface SumoBrain {
  nextThink: number;
  out: { dx: number; dy: number; skill1: boolean; skill2: boolean; cashout: boolean };
  wander: number;
}
