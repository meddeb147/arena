import { clamp, type PlayerInput } from '@arena/shared';
import { isProtected, type BotPersona, type Sim } from '../../types';
import { APOTHEM, ARENA_CX, ARENA_CY, VOLT } from './config';
import type { VoltBrain, VoltFighter, VoltState } from './types';

type S = Sim<VoltFighter, VoltState>;

export function createVoltBrain(sim: S): VoltBrain {
  return { nextThink: sim.tick, out: { dx: 0, dy: 0, skill1: false, skill2: false, cashout: false }, wander: sim.rng.range(0, Math.PI * 2) };
}

/** Brawler bot: dodge lightning and pylons, hunt the weakest nearby fighter, heal when hurt. */
export function voltBotInput(sim: S, e: VoltFighter, brain: VoltBrain, persona: BotPersona): PlayerInput {
  const out = brain.out;
  out.skill1 = false;
  out.skill2 = false;
  if (sim.tick < brain.nextThink) return { seq: sim.tick, ...out };
  brain.nextThink = sim.tick + Math.round(clamp(8 - persona.skill * 6, 2, 8)) + sim.rng.int(0, 2);

  let fx = 0;
  let fy = 0;
  let inStrike = false;
  for (const s of sim.state.strikes) {
    if (sim.tick >= s.fireTick) continue;
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < s.r + e.r + 50) {
      const w = 6 * (1 - d / (s.r + e.r + 50)) + 1;
      fx += (dx / d) * w;
      fy += (dy / d) * w;
      if (d < s.r + e.r * 0.5 && s.fireTick - sim.tick < 10) inStrike = true;
    }
  }
  for (const p of sim.state.pylons) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < p.r + e.r + 70) {
      fx += (dx / d) * 3;
      fy += (dy / d) * 3;
    }
  }
  const cdx = e.x - ARENA_CX;
  const cdy = e.y - ARENA_CY;
  const cd = Math.hypot(cdx, cdy) || 1;
  if (cd > APOTHEM - 160) {
    fx -= (cdx / cd) * 2.5;
    fy -= (cdy / cd) * 2.5;
  }

  let target: VoltFighter | null = null;
  let bestScore = 0;
  let nearestEnemy = Infinity;
  let incoming = false;
  for (const o of sim.entities.values()) {
    if (o === e || !o.alive) continue;
    const d = Math.hypot(o.x - e.x, o.y - e.y);
    nearestEnemy = Math.min(nearestEnemy, d);
    if (o.effects[0] > 0 && d < 170) incoming = true;
    if (isProtected(sim, o) || o.effects[1] > 0 || d > 600) continue;
    const score = ((1.6 - o.hp / VOLT.maxHp) * (0.4 + persona.aggression)) / (d + 60);
    if (score > bestScore) {
      bestScore = score;
      target = o;
    }
  }

  let gx = 0;
  let gy = 0;
  const hurt = e.hp < 40 + (1 - persona.aggression) * 30;
  // fight in bursts: after trading blows, timid bots disengage for a while
  if (sim.tick - e.lastDamagedTick < 20 && sim.rng.chance((1 - persona.aggression) * 0.25)) brain.wander = Math.atan2(e.y - (target?.y ?? e.y), e.x - (target?.x ?? e.x));
  const engage = target !== null && (sim.tick % 240 < 120 + persona.aggression * 120);
  let orb: { x: number; y: number } | null = null;
  if (e.hp < 70) {
    let bd = 600;
    for (const o of sim.state.orbs) {
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < bd) {
        bd = d;
        orb = o;
      }
    }
  }
  if (hurt && orb) {
    const d = Math.hypot(orb.x - e.x, orb.y - e.y) || 1;
    gx = (orb.x - e.x) / d;
    gy = (orb.y - e.y) / d;
  } else if (target && engage && !(hurt && nearestEnemy < 260)) {
    const d = Math.hypot(target.x - e.x, target.y - e.y) || 1;
    gx = (target.x - e.x) / d;
    gy = (target.y - e.y) / d;
    if (d < 230 && d > 60 && e.cooldowns[0] === 0 && sim.rng.chance(persona.skill * persona.aggression * 0.6)) out.skill1 = true;
  } else if (hurt && target) {
    const d = Math.hypot(target.x - e.x, target.y - e.y) || 1;
    gx = -(target.x - e.x) / d;
    gy = -(target.y - e.y) / d;
  } else {
    brain.wander += sim.rng.range(-0.5, 0.5);
    gx = Math.cos(brain.wander) * 0.6 - (cdx / cd) * 0.4;
    gy = Math.sin(brain.wander) * 0.6 - (cdy / cd) * 0.4;
  }

  if ((inStrike || incoming) && e.cooldowns[1] === 0 && sim.rng.chance(persona.skill)) out.skill2 = true;

  out.cashout = sim.stakeOf(e) >= persona.cashoutAt && nearestEnemy > 300 && !inStrike;

  let dx = fx + gx;
  let dy = fy + gy;
  const m = Math.hypot(dx, dy);
  if (m > 0.001) {
    dx /= m;
    dy /= m;
  }
  out.dx = dx;
  out.dy = dy;
  if (out.skill1) {
    // dash straight at the target, not along the blended steering
    if (target) {
      const d = Math.hypot(target.x - e.x, target.y - e.y) || 1;
      out.dx = (target.x - e.x) / d;
      out.dy = (target.y - e.y) / d;
    }
  }
  return { seq: sim.tick, ...out };
}
