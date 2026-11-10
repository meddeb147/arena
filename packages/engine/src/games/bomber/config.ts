import { TICK_RATE } from '@arena/shared';
import type { GameConfig } from '../../types';

const s = (sec: number) => Math.round(sec * TICK_RATE);

export const BOMBER_CONFIG: GameConfig = {
  id: 'bomber',
  width: 2100,
  height: 2100,
  viewRadius: 1300,
  skills: [
    { name: 'Bomb', cooldownTicks: s(0.9), durationTicks: 0 },
    { name: 'Shield', cooldownTicks: s(8), durationTicks: s(1.2) },
  ],
};

export const BOMBER = {
  radius: 24,
  speed: 250,
  cashoutSpeedMul: 0.55,
  steerRate: 10,
  maxBombs: 3,
  fuse: s(2.0),
  bombRadius: 20,
  blast: 175,
  /** kicked bombs slide and slow down */
  kickSpeed: 520,
  bombFriction: 2.4,
  chainDelay: 3,
  pillarSpacing: 420,
  pillarRadius: 46,
  /** bombs that fall from the sky (no owner) */
  skyEvery: s(1.5),
  skyWarn: s(1.6),
} as const;

export const BomberKind = { Player: 0, Bomb: 1, Pillar: 2, SkyMark: 3 } as const;
