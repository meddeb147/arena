import type { BaseEntity } from '../../types';

export interface Bomber extends BaseEntity {
  /** bombs this player has placed and that are still ticking */
  live: number;
}
export interface Bomb { id: number; x: number; y: number; vx: number; vy: number; owner: number | null; fuseAt: number; ownerClear: boolean; bornAt: number }
export interface SkyMark { id: number; x: number; y: number; dropAt: number }
export interface BomberState { bombs: Bomb[]; pillars: { id: number; x: number; y: number; r: number }[]; marks: SkyMark[]; nextSky: number }
export interface BomberBrain { nextThink: number; out: { dx: number; dy: number; skill1: boolean; skill2: boolean; cashout: boolean }; wander: number; retreatUntil: number; rx: number; ry: number }
