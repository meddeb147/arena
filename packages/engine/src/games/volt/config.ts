import { TICK_RATE } from '@arena/shared';
import type { GameConfig } from '../../types';

const s = (sec: number) => Math.round(sec * TICK_RATE);

export const VOLT_CONFIG: GameConfig = {
  id: 'volt',
  width: 2800,
  height: 2800,
  viewRadius: 1400,
  skills: [
    { name: 'Volt Dash', cooldownTicks: s(3), durationTicks: s(0.27) },
    { name: 'Shield', cooldownTicks: s(8), durationTicks: s(1.5) },
  ],
};

/** Tunables for Volt Brawl. */
export const VOLT = {
  /** octagon circumradius; the cage is centred in the world */
  arenaRadius: 1250,
  wallBounce: 0.55,
  /** a wall hit faster than this hurts */
  slamSpeed: 520,
  slamDamage: 12,

  radius: 28,
  maxHp: 100,
  speed: 250,
  cashoutSpeedMul: 0.55,
  steerRate: 10,
  knockDamp: 5.5,

  jabReach: 30,
  jabDamage: 6,
  jabKnock: 240,
  jabCooldown: s(0.5),
  punchAnim: s(0.17),

  dashSpeedMul: 3.2,
  dashDamage: 24,
  dashKnock: 760,

  /** shield also softens knockback */
  shieldKnockMul: 0.3,

  regenDelay: s(3),
  regenPerSecond: 4,
  healOnKill: 25,

  /** who hit you last within this window gets the kill */
  creditWindow: s(4),

  strikeWarn: s(1.35),
  strikeShow: s(0.3),
  strikeRadius: 110,
  strikeDamage: 65,
  strikeKnock: 600,
  /** chance a strike targets a fighter rather than a random spot */
  strikeAim: 0.7,

  pylonRadius: 38,
  pylonDistance: 430,
  pylonDamage: 22,
  pylonKnock: 520,
  pylonCooldown: s(0.6),

  orbMax: 8,
  orbEvery: s(2),
  orbHeal: 30,
  orbRadius: 14,
} as const;

/** Snapshot kind codes for the Volt renderer. */
export const VoltKind = { Fighter: 0, Strike: 1, Pylon: 2, Orb: 3, Bolt: 4 } as const;

export const ARENA_CX = VOLT_CONFIG.width / 2;
export const ARENA_CY = VOLT_CONFIG.height / 2;
/** distance from centre to each flat wall */
export const APOTHEM = VOLT.arenaRadius * Math.cos(Math.PI / 8);
/** outward wall normals: flat walls facing the axes and the diagonals */
export const WALL_NORMALS: ReadonlyArray<readonly [number, number]> = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)] as const;
});

/** Seconds between strikes: busier arenas get more lightning. */
export const strikeInterval = (alive: number): number => Math.max(14, Math.round(66 - alive * 2.4));
