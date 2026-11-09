import { TICK_RATE } from '@arena/shared';
import type { GameConfig } from '../../types';

export const BLOB_CONFIG: GameConfig = {
  id: 'blob',
  width: 3200,
  height: 3200,
  viewRadius: 1100,
  skills: [
    { name: 'Dash', cooldownTicks: Math.round(3 * TICK_RATE), durationTicks: Math.round(0.3 * TICK_RATE) },
    { name: 'Shield', cooldownTicks: Math.round(9 * TICK_RATE), durationTicks: Math.round(2 * TICK_RATE) },
  ],
};

/** Tunables. Keep game-feel numbers here, not scattered through the code. */
export const BLOB = {
  spawnMass: 20,
  maxMass: 3000,
  pelletTarget: 850,
  pelletSpawnPerTick: 10,
  bigPelletChance: 0.06,
  /** a cell can eat another if its mass is at least this multiple */
  eatRatio: 1.2,
  /** how far the smaller cell must be inside the bigger one (fraction of small radius) */
  eatOverlap: 0.35,
  decayAboveMass: 60,
  decayPerSecond: 0.004,
  dashMinMass: 24,
  dashMassCost: 0.08,
  dashSpeedMul: 2.8,
  cashoutSpeedMul: 0.55,
  trapCount: 9,
  trapRadius: 46,
  /** cells must be this much larger than a trap for it to pop them (small cells hide under traps) */
  trapPopRatio: 1.12,
  trapDropFraction: 0.6,
  gridCell: 128,
} as const;

export const radiusFor = (mass: number): number => 6 * Math.sqrt(mass);
export const speedFor = (mass: number): number => 240 * Math.pow(BLOB.spawnMass / Math.max(mass, BLOB.spawnMass), 0.3);

/** Snapshot kind codes for this game's renderer. */
export const BlobKind = { Cell: 0, Pellet: 1, Trap: 2 } as const;
