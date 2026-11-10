import { TICK_RATE } from '@arena/shared';
import type { GameConfig } from '../../types';

const s = (sec: number) => Math.round(sec * TICK_RATE);

export const POTATO_CONFIG: GameConfig = {
  id: 'potato',
  width: 2400,
  height: 2400,
  viewRadius: 1300,
  skills: [
    { name: 'Dash', cooldownTicks: s(2.5), durationTicks: s(0.25) },
    { name: 'Shield', cooldownTicks: s(9), durationTicks: s(1.5) },
  ],
};

export const POTATO = {
  radius: 26,
  speed: 245,
  /** the holder is a bit faster: hunting is easier than running */
  holderSpeedMul: 1.12,
  dashMul: 3,
  cashoutSpeedMul: 0.55,
  steerRate: 10,
  fuse: s(9),
  /** the player who just passed can't take it straight back */
  passImmunity: s(0.7),
  respawnDelay: s(1.5),
  /** one potato per this many players, 1..3 */
  playersPerPotato: 6,
  maxPotatoes: 3,
  blastKnock: 520,
  blastRadius: 150,
  pillarCount: 6,
} as const;

export const PotatoKind = { Player: 0, Potato: 1, Pillar: 2 } as const;
