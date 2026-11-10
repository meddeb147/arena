import { TICK_RATE } from '@arena/shared';
import type { GameConfig } from '../../types';

const s = (sec: number) => Math.round(sec * TICK_RATE);

export const BLADE_CONFIG: GameConfig = {
  id: 'blade',
  width: 2500,
  height: 2500,
  viewRadius: 1300,
  skills: [
    { name: 'Dash', cooldownTicks: s(3), durationTicks: s(0.25) },
    { name: 'Shield', cooldownTicks: s(8), durationTicks: s(1.5) },
  ],
};

export const BLADE = {
  radius: 26,
  speed: 240,
  dashMul: 3,
  cashoutSpeedMul: 0.55,
  steerRate: 9,
  knockDamp: 5,
  spin: 3.4,
  baseLength: 46,
  perOrb: 2.6,
  maxLength: 240,
  /** longer blades make you a little slower */
  slowPerLength: 0.0011,
  orbTarget: 420,
  orbSpawnPerTick: 8,
  clashKnock: 520,
  clashCooldown: s(0.3),
  lavaCount: 6,
  creditWindow: s(3),
  dropFraction: 0.7,
} as const;

export const BladeKind = { Spinner: 0, Orb: 1, Lava: 2 } as const;
export const bladeLength = (orbs: number) => Math.min(BLADE.maxLength, BLADE.baseLength + orbs * BLADE.perOrb);
