import type { BaseEntity } from '../../types';

export interface Tank extends BaseEntity {
  hp: number;
  turret: number;
  fireCd: number;
  dashX: number;
  dashY: number;
  kvx: number;
  kvy: number;
  lastDamagedTick: number;
  firing: number;
}
export interface Shell { id: number; x: number; y: number; vx: number; vy: number; owner: number; life: number }
export interface Crate { id: number; x: number; y: number; r: number }
export interface Mine { id: number; x: number; y: number; armedAt: number; respawnAt: number }
export interface Kit { id: number; x: number; y: number }
export interface TankState { shells: Shell[]; crates: Crate[]; mines: Mine[]; kits: Kit[]; nextKit: number }
export interface TankBrain { nextThink: number; out: { dx: number; dy: number; skill1: boolean; skill2: boolean; cashout: boolean }; orbit: number }
