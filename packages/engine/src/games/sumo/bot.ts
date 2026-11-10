import { clamp, type PlayerInput } from '@arena/shared';
import { isProtected, type BotPersona, type Sim } from '../../types';
import { SUMO_CX, SUMO_CY } from './config';
import type { SumoBrain, SumoState, Wrestler } from './types';

type S = Sim<Wrestler, SumoState>;

export function createSumoBrain(sim: S): SumoBrain {
  return { nextThink: sim.tick, out: { dx: 0, dy: 0, skill1: false, skill2: false, cashout: false }, wander: sim.rng.range(0, Math.PI * 2) };
}

/** Sumo bot: stay away from the edge, push whoever is closest to the edge, brace (Heavy) when rammed. */
export function sumoBotInput(sim: S, e: Wrestler, brain: SumoBrain, persona: BotPersona): PlayerInput {
  const out = brain.out;
  out.skill1 = false;
  out.skill2 = false;
  if (sim.tick < brain.nextThink) return { seq: sim.tick, ...out };
  brain.nextThink = sim.tick + Math.round(clamp(7 - persona.skill * 5, 2, 7)) + sim.rng.int(0, 2);

  const R = sim.state.radius;
  const cdx = e.x - SUMO_CX;
  const cdy = e.y - SUMO_CY;
  const cd = Math.hypot(cdx, cdy) || 1;
  let gx = 0;
  let gy = 0;
  // edge fear grows near the rim
  const edge = cd / R;
  if (edge > 0.5) {
    gx -= (cdx / cd) * (edge - 0.5) * 8;
    gy -= (cdy / cd) * (edge - 0.5) * 8;
    // sliding outwards near the rim: brake hard
    const outward = (e.vx * cdx + e.vy * cdy) / cd;
    if (outward > 60) {
      gx -= (e.vx / (Math.hypot(e.vx, e.vy) || 1)) * 2;
      gy -= (e.vy / (Math.hypot(e.vx, e.vy) || 1)) * 2;
    }
  }
  for (const b of sim.state.bumpers) {
    const d = Math.hypot(e.x - b.x, e.y - b.y) || 1;
    if (d < b.r + e.r + 60) {
      gx += ((e.x - b.x) / d) * 1.5;
      gy += ((e.y - b.y) / d) * 1.5;
    }
  }
  let target: Wrestler | null = null;
  let best = -Infinity;
  let threat = false;
  for (const o of sim.entities.values()) {
    if (o === e || !o.alive || o.falling) continue;
    const d = Math.hypot(o.x - e.x, o.y - e.y);
    if (o.effects[0] > 0 && d < 200) threat = true;
    if (isProtected(sim, o) || d > 650) continue;
    // prefer targets near the edge: one good shove finishes them
    const oEdge = Math.hypot(o.x - SUMO_CX, o.y - SUMO_CY) / R;
    const score = oEdge * 2 - d / 400 + persona.aggression;
    if (score > best) {
      best = score;
      target = o;
    }
  }
  if (target && edge < 0.85) {
    // approach from the centre side so the push goes outwards
    const tdx = target.x - SUMO_CX;
    const tdy = target.y - SUMO_CY;
    const td = Math.hypot(tdx, tdy) || 1;
    const behindX = target.x - (tdx / td) * 40;
    const behindY = target.y - (tdy / td) * 40;
    const d = Math.hypot(behindX - e.x, behindY - e.y) || 1;
    gx += (behindX - e.x) / d;
    gy += (behindY - e.y) / d;
    const dist = Math.hypot(target.x - e.x, target.y - e.y);
    const targetEdge = td / R;
    if (dist < 240 && targetEdge > 0.5 && e.cooldowns[0] === 0 && sim.rng.chance(persona.skill * persona.aggression * 0.6)) {
      out.skill1 = true;
      gx = (target.x - e.x) / dist;
      gy = (target.y - e.y) / dist;
    }
  } else {
    brain.wander += sim.rng.range(-0.5, 0.5);
    gx += Math.cos(brain.wander) * 0.4;
    gy += Math.sin(brain.wander) * 0.4;
  }
  if (threat && e.cooldowns[1] === 0 && sim.rng.chance(persona.skill)) out.skill2 = true;
  out.cashout = sim.stakeOf(e) >= persona.cashoutAt && !threat && edge < 0.6;

  const m = Math.hypot(gx, gy);
  out.dx = m > 0.01 ? gx / Math.max(1, m) : 0;
  out.dy = m > 0.01 ? gy / Math.max(1, m) : 0;
  return { seq: sim.tick, ...out };
}
