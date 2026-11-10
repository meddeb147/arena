import { clamp, type PlayerInput } from '@arena/shared';
import { isProtected, type BotPersona, type Sim } from '../../types';
import { LEVEL, STOMP, STOMP_CONFIG } from './config';
import { surfaces } from './sim';
import type { StompBrain, StompState, Stomper } from './types';

type S = Sim<Stomper, StompState>;

export function createStompBrain(sim: S): StompBrain {
  return { nextThink: sim.tick, out: { dx: 0, dy: 0, skill1: false, skill2: false, cashout: false }, wander: sim.rng.chance(0.5) ? 1 : -1, jumpHold: 0 };
}

/** Is there something to stand on below (x, fromY) before the lava? */
function groundBelow(state: StompState, x: number, fromY: number): number | null {
  let best: number | null = null;
  for (const [px, py, pw] of surfaces(state)) {
    if (x < px || x > px + pw || py < fromY) continue;
    if (best === null || py < best) best = py;
  }
  return best;
}

/**
 * Platformer bot: chase a target, get above it and drop (or pound) on its head,
 * jump gaps, never walk off into lava, hop over spikes, dodge players above.
 */
export function stompBotInput(sim: S, e: Stomper, brain: StompBrain, persona: BotPersona): PlayerInput {
  const out = brain.out;
  out.skill1 = false;
  out.skill2 = false;
  // keep holding jump for a few ticks for full-height jumps
  if (brain.jumpHold > 0) {
    brain.jumpHold--;
    out.dy = -1;
  } else out.dy = 0;
  if (sim.tick < brain.nextThink) return { seq: sim.tick, ...out };
  brain.nextThink = sim.tick + Math.round(clamp(5 - persona.skill * 4, 1, 5)) + sim.rng.int(0, 1);
  const feet = e.y + STOMP.hh;

  // danger from above: someone falling onto us
  let threat: Stomper | null = null;
  let target: Stomper | null = null;
  let td = Infinity;
  for (const o of sim.entities.values()) {
    if (o === e || !o.alive) continue;
    const dx = o.x - e.x;
    const dy = o.y - e.y;
    if (dy < -10 && dy > -360 && Math.abs(dx) < 120 && o.vy > -200 && sim.rng.chance(0.4 + persona.skill * 0.6)) threat = o;
    if (isProtected(sim, o)) continue;
    const d = Math.hypot(dx, dy * 1.5);
    if (d < td && d < 600 + persona.aggression * 800) {
      td = d;
      target = o;
    }
  }

  let dir = 0;
  let wantJump = false;
  if (threat) {
    dir = threat.x > e.x ? -1 : 1;
  } else if (target && (sim.tick + e.id * 37) % 300 < 70 + persona.aggression * 110) {
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    dir = Math.abs(dx) > 20 ? Math.sign(dx) : 0;
    if (dy < -120 && e.grounded) wantJump = true; // they're above: go up
    // we're above them and lined up: drop or pound
    if (dy > 60 && Math.abs(dx) < 60 && !e.grounded && e.vy > -100 && e.cooldowns[1] === 0 && sim.rng.chance(persona.skill * persona.aggression)) out.skill2 = true;
    if (dy > 60 && Math.abs(dx) < 140 && e.grounded) dir = Math.sign(dx) || brain.wander;
  } else {
    dir = brain.wander;
    if (sim.rng.chance(0.03)) brain.wander *= -1;
  }

  // don't walk into lava: look ahead for ground
  const ahead = e.x + dir * (STOMP.hw + 40);
  const below = groundBelow(sim.state, ahead, feet - 4);
  if (e.grounded && dir !== 0 && (below === null || below > STOMP.lavaY - 100)) {
    // a gap with lava under it: jump it if there is ground further on, else turn back
    const far = groundBelow(sim.state, e.x + dir * 300, feet - 200);
    if (far !== null && far < STOMP.lavaY - 100) wantJump = true;
    else {
      dir = -dir;
      brain.wander = dir as 1 | -1;
    }
  }
  // falling toward lava: double jump back toward any ground
  if (!e.grounded && e.vy > 200 && groundBelow(sim.state, e.x, feet) === null && e.canDouble) {
    wantJump = true;
    const left = groundBelow(sim.state, e.x - 260, feet - 300);
    const right = groundBelow(sim.state, e.x + 260, feet - 300);
    dir = right !== null && (left === null || Math.abs(right - feet) < Math.abs(left - feet)) ? 1 : -1;
  }
  // in the air above spikes: steer away (double-jump if we can)
  if (!e.grounded) {
    for (const [sx, sy, sw] of LEVEL.spikes) {
      const landingX = e.x + e.vx * 0.25;
      if (feet < sy && sy - feet < 260 && landingX > sx - 30 && landingX < sx + sw + 30) {
        dir = landingX < sx + sw / 2 ? -1 : 1;
        if (e.vy > 0 && e.canDouble) wantJump = true;
      }
    }
  }
  // hop over spikes
  for (const [sx, sy, sw] of LEVEL.spikes) {
    if (Math.abs(feet - sy) < 8 && e.grounded && ((dir > 0 && sx - e.x > 0 && sx - e.x < 120) || (dir < 0 && e.x - (sx + sw) > 0 && e.x - (sx + sw) < 120))) wantJump = true;
  }
  if (e.x < 80) dir = 1;
  if (e.x > STOMP_CONFIG.width - 80) dir = -1;
  if (wantJump && (e.grounded || e.canDouble)) {
    out.dy = -1;
    brain.jumpHold = 8;
  }
  out.dx = dir;
  out.cashout = sim.stakeOf(e) >= persona.cashoutAt && e.grounded && td > 380 && !threat;
  return { seq: sim.tick, ...out };
}
