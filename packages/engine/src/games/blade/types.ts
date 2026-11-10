import type { BaseEntity } from '../../types';
import type { SpatialGrid } from '../../spatial';

export interface Spinner extends BaseEntity {
  orbs: number;
  spinAngle: number;
  spinDir: 1 | -1;
  dashX: number;
  dashY: number;
  kvx: number;
  kvy: number;
}
export interface BladeOrb { id: number; x: number; y: number; v: number }
export interface Lava { id: number; x: number; y: number; r: number; cx: number; cy: number; orbitR: number; speed: number; phase: number }
export interface BladeState { orbs: Map<number, BladeOrb>; grid: SpatialGrid<BladeOrb>; lava: Lava[]; clash: Map<string, number> }
export interface BladeBrain { nextThink: number; out: { dx: number; dy: number; skill1: boolean; skill2: boolean; cashout: boolean }; wander: number }
