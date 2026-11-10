import type { BaseEntity } from '../../types';

export interface Runner extends BaseEntity {
  kvx: number;
  kvy: number;
  dashX: number;
  dashY: number;
}
export interface Potato { id: number; holder: number | null; explodeAt: number; lastPasser: number | null; immune: { id: number; until: number } | null; readyAt: number; x: number; y: number }
export interface PotatoState { potatoes: Potato[]; pillars: { id: number; x: number; y: number; r: number }[] }
export interface PotatoBrain { nextThink: number; out: { dx: number; dy: number; skill1: boolean; skill2: boolean; cashout: boolean }; wander: number }
