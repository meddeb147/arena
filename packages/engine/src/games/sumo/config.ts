import { TICK_RATE } from '@arena/shared';
import type { GameConfig } from '../../types';

const s = (sec: number) => Math.round(sec * TICK_RATE);

export const SUMO_CONFIG: GameConfig = {
  id: 'sumo',
  width: 2600,
  height: 2600,
  viewRadius: 1400,
  skills: [
    { name: 'Ram', cooldownTicks: s(2.6), durationTicks: s(0.25) },
    { name: 'Heavy', cooldownTicks: s(7), durationTicks: s(2) },
  ],
};

/** Tunables for Sumo Smash. */
export const SUMO = {
  /** the platform breathes: big -> small over `shrinkTime`, holds, then snaps back */
  maxRadius: 1050,
  minRadius: 520,
  shrinkTime: s(28),
  holdTime: s(4),
  snapTime: s(1),
  radius: 30,
  accel: 1200,
  maxSpeed: 300,
  friction: 3.0,
  restitution: 0.85,
  /** extra push given on every collision, so bumps always matter */
  bumpImpulse: 150,
  ramSpeed: 820,
  ramPushMul: 1.8,
  heavyMass: 4,
  heavySpeedMul: 0.55,
  cashoutSpeedMul: 0.55,
  creditWindow: s(4),
  /** pinball bumpers orbiting the centre */
  bumperCount: 3,
  bumperRadius: 46,
  bumperOrbit: 210,
  bumperSpin: 0.5,
  bumperKick: 600,
  /** the snap-back shockwave shoves everyone outwards */
  shockwave: 380,
} as const;

export const SumoKind = { Fighter: 0, Platform: 1, Bumper: 2 } as const;
export const SUMO_CX = SUMO_CONFIG.width / 2;
export const SUMO_CY = SUMO_CONFIG.height / 2;

/** Platform radius at a tick, plus the phase for visuals (0..1 shrinking, 1 holding, 2 snapping). */
export function platformAt(tick: number): { r: number; phase: number; snapping: boolean } {
  const cycle = SUMO.shrinkTime + SUMO.holdTime + SUMO.snapTime;
  const t = tick % cycle;
  if (t < SUMO.shrinkTime) {
    const k = t / SUMO.shrinkTime;
    const eased = k * k * (3 - 2 * k);
    return { r: SUMO.maxRadius - (SUMO.maxRadius - SUMO.minRadius) * eased, phase: k, snapping: false };
  }
  if (t < SUMO.shrinkTime + SUMO.holdTime) return { r: SUMO.minRadius, phase: 1, snapping: false };
  const k = (t - SUMO.shrinkTime - SUMO.holdTime) / SUMO.snapTime;
  return { r: SUMO.minRadius + (SUMO.maxRadius - SUMO.minRadius) * (1 - (1 - k) ** 3), phase: 2, snapping: true };
}
