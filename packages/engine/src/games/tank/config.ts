import { TICK_RATE } from '@arena/shared';
import type { GameConfig } from '../../types';

const s = (sec: number) => Math.round(sec * TICK_RATE);

export const TANK_CONFIG: GameConfig = {
  id: 'tank',
  width: 2800,
  height: 2800,
  viewRadius: 1300,
  skills: [
    { name: 'Dash', cooldownTicks: s(3), durationTicks: s(0.3) },
    { name: 'Shield', cooldownTicks: s(8), durationTicks: s(1.6) },
  ],
};

export const TANK = {
  radius: 30,
  maxHp: 100,
  speed: 225,
  dashMul: 2.7,
  cashoutSpeedMul: 0.55,
  steerRate: 8,
  knockDamp: 6,
  range: 560,
  turretTurn: 5.5,
  fireCooldown: s(0.6),
  aimTolerance: 0.16,
  shellSpeed: 760,
  shellLife: s(0.85),
  shellDamage: 16,
  shellKnock: 160,
  crateCount: 16,
  mineCount: 10,
  mineRadius: 18,
  mineTrigger: 44,
  mineBlast: 120,
  mineDamage: 55,
  mineKnock: 650,
  mineRespawn: s(6),
  mineArm: s(1.2),
  kitMax: 5,
  kitEvery: s(3),
  kitHeal: 30,
  regenDelay: s(3),
  regenPerSecond: 4,
  healOnKill: 25,
  creditWindow: s(4),
} as const;

export const TankKind = { Tank: 0, Shell: 1, Crate: 2, Mine: 3, Kit: 4 } as const;
