import { TICK_RATE } from '@arena/shared';
import type { GameConfig } from '../../types';

const s = (sec: number) => Math.round(sec * TICK_RATE);

export const STOMP_CONFIG: GameConfig = {
  id: 'stomp',
  width: 3600,
  height: 2000,
  viewRadius: 1500,
  /** platformers get crowded fast */
  population: 10,
  skills: [
    { name: 'Jump', cooldownTicks: 2, durationTicks: 0 },
    { name: 'Ground Pound', cooldownTicks: s(2.2), durationTicks: s(0.6) },
  ],
};

export const STOMP = {
  /** half-width / half-height of a character's box */
  hw: 22,
  hh: 26,
  gravity: 2600,
  maxFall: 1500,
  runSpeed: 380,
  accelGround: 3200,
  accelAir: 1700,
  friction: 2800,
  jumpSpeed: 1020,
  doubleJumpSpeed: 880,
  /** releasing jump early cuts the jump short (variable height) */
  jumpCut: 0.55,
  /** a tiny grace period to jump after leaving a ledge */
  coyote: 4,
  poundSpeed: 1800,
  stompBounce: 820,
  /** must be falling at least this fast to stomp */
  stompMinVy: 420,
  springSpeed: 1600,
  bumpPush: 420,
  creditWindow: s(3),
  cashoutSpeedMul: 0.55,
  /** y of the lava surface */
  lavaY: 1880,
} as const;

/** Level layout (x, y = top-left; one-way platforms you can jump through from below). */
export const LEVEL = {
  platforms: [
    // ground islands over the lava
    [0, 1700, 760, 60], [980, 1740, 520, 60], [1700, 1700, 620, 60], [2520, 1740, 520, 60], [3260, 1700, 340, 60],
    // low tier
    [260, 1420, 380, 28], [900, 1460, 300, 28], [1460, 1380, 360, 28], [2060, 1440, 320, 28], [2700, 1420, 380, 28], [3180, 1380, 300, 28],
    // mid tier
    [120, 1120, 300, 28], [620, 1160, 340, 28], [1240, 1080, 280, 28], [1800, 1120, 420, 28], [2480, 1100, 320, 28], [3000, 1140, 360, 28],
    // high tier
    [420, 820, 320, 28], [1020, 780, 300, 28], [1560, 720, 480, 28], [2280, 800, 300, 28], [2860, 820, 340, 28],
    // summit
    [880, 500, 260, 28], [1680, 420, 240, 28], [2440, 500, 260, 28],
  ] as [number, number, number, number][],
  /** moving platforms: x, y, w, travel (px), speed (rad/s) */
  movers: [
    [760, 1560, 200, 220, 0.9], [2340, 1560, 180, 200, 1.1], [1500, 920, 200, 320, 0.7], [3080, 620, 200, 260, 0.8],
  ] as [number, number, number, number, number][],
  /** springs: x (centre), y (top of the platform they sit on) */
  springs: [[200, 1700], [1240, 1740], [2780, 1740], [2140, 1120], [560, 1420]] as [number, number][],
  /** spike strips: x, y (top of the platform), w */
  spikes: [[1900, 1700, 90], [3360, 1700, 70], [1880, 1120, 70]] as [number, number, number][],
};

export const StompKind = { Player: 0, Platform: 1, Spring: 2, Spikes: 3, Mover: 4 } as const;
