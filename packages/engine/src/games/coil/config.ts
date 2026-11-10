import { TICK_RATE } from '@arena/shared';
import type { GameConfig } from '../../types';

const s = (sec: number) => Math.round(sec * TICK_RATE);

export const COIL_CONFIG: GameConfig = {
  id: 'coil',
  width: 3400,
  height: 3400,
  viewRadius: 1200,
  skills: [
    { name: 'Jump', cooldownTicks: s(4), durationTicks: s(0.65) },
    { name: 'Magnet', cooldownTicks: s(9), durationTicks: s(3) },
  ],
};

/** Tunables for Coil Stake. */
export const COIL = {
  speed: 215,
  cashoutSpeedMul: 0.6,
  /** radians per second */
  turnRate: 3.8,
  /** distance between recorded body points */
  segSpacing: 9,
  startMass: 10,
  baseLength: 140,
  lengthPerMass: 7,
  maxMass: 900,
  pelletTarget: 900,
  pelletSpawnPerTick: 12,
  goldenChance: 0.03,
  /** share of a dead snake's mass dropped along its body */
  dropFraction: 0.75,
  magnetRadius: 240,
  magnetPull: 520,
  trapCount: 7,
  trapRadius: 40,
  /** walls kill: keep the head this far inside */
  wallMargin: 6,
  gridCell: 128,
  /** body points skipped near another snake's head (so head-to-head grazes are fair) */
  neckSkip: 3,
} as const;

export const lengthFor = (mass: number): number => COIL.baseLength + mass * COIL.lengthPerMass;
export const radiusFor = (mass: number): number => Math.min(26, 11 + Math.sqrt(mass) * 0.55);

/** Snapshot kind codes for the Coil renderer. */
export const CoilKind = { Snake: 0, Pellet: 1, Trap: 2 } as const;
