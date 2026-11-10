import { clamp, type PlayerInput } from '@arena/shared';
import { isProtected, type BotPersona, type Sim } from '../../types';
import { BOMBER, BOMBER_CONFIG } from './config';
import type { Bomber, BomberBrain, BomberState } from './types';

type S = Sim<Bomber, BomberState>;

export function createBomberBrain(sim: S): BomberBrain {
  return { nextThink: sim.tick, out: { dx: 0, dy: 0, skill1: false, skill2: false, cashout: false }, wander: sim.rng.range(0, 6.28), retreatUntil: 0, rx: 0, ry: 0 };
}

/** Bomber bot: run from every blast zone first, then drop bombs near enemies and kick them. */
export function bomberBotInput(sim: S, e: Bomber, brain: BomberBrain, persona: BotPersona): PlayerInput {
  const out = brain.out;
  out.skill1 = false;
  out.skill2 = false;
  if (sim.tick < brain.nextThink) return { seq: sim.tick, ...out };
  brain.nextThink = sim.tick + Math.round(clamp(9 - persona.skill * 6, 3, 9)) + sim.rng.int(0, 2);
  let fx = 0;
  let fy = 0;
  let inDanger = false;
  let soonest = Infinity;
  const zone = (x: number, y: number, ticksLeft: number, own = false) => {
    const dx = e.x - x;
    const dy = e.y - y;
    const d = Math.hypot(dx, dy) || 1;
    // weaker bots notice danger late
    if (!own && (d > BOMBER.blast + e.r + 20 + persona.skill * 50 || ticksLeft > 30 + persona.skill * 40)) return;
    if (own && d > BOMBER.blast + e.r + 50) return;
    inDanger = true;
    soonest = Math.min(soonest, ticksLeft);
    const urgency = 1 + 40 / Math.max(4, ticksLeft);
    fx += (dx / d) * urgency * 2;
    fy += (dy / d) * urgency * 2;
  };
  for (const b of sim.state.bombs) zone(b.x, b.y, b.fuseAt - sim.tick, b.owner === e.id);
  for (const m of sim.state.marks) zone(m.x, m.y, m.dropAt - sim.tick + 12);
  let target: Bomber | null = null;
  let td = Infinity;
  for (const o of sim.entities.values()) {
    if (o === e || !o.alive || isProtected(sim, o)) continue;
    const d = Math.hypot(o.x - e.x, o.y - e.y);
    if (d < td) {
      td = d;
      target = o;
    }
  }
  let gx = 0;
  let gy = 0;
  // just dropped a bomb: get out first, think later
  if (sim.tick < brain.retreatUntil) {
    out.dx = brain.rx;
    out.dy = brain.ry;
    return { seq: sim.tick, ...out };
  }
  if (!inDanger && target) {
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const d = td || 1;
    const want = 70 + (1 - persona.aggression) * 90;
    gx = (dx / d) * (d - want) / 120;
    gy = (dy / d) * (d - want) / 120;
    if (d < 240 && e.live < BOMBER.maxBombs && e.cooldowns[0] === 0 && sim.rng.chance(0.5 + persona.aggression * 0.4)) {
      out.skill1 = true;
      // retreat away from the target (and the bomb at our feet), sliding off pillars
      let ax = -(dx / d);
      let ay = -(dy / d);
      for (const p of sim.state.pillars) {
        const pd = Math.hypot(e.x + ax * 120 - p.x, e.y + ay * 120 - p.y);
        if (pd < p.r + 40) {
          const t = ax;
          ax = -ay;
          ay = t;
        }
      }
      brain.retreatUntil = sim.tick + 45;
      brain.rx = ax;
      brain.ry = ay;
      out.dx = 0;
      out.dy = 0;
      return { seq: sim.tick, ...out };
    }
    // kick a nearby bomb toward the target: walk into it from the far side
    for (const b of sim.state.bombs) {
      const bd = Math.hypot(b.x - e.x, b.y - e.y);
      const tb = Math.hypot(target.x - b.x, target.y - b.y) || 1;
      if (bd < 120 && b.fuseAt - sim.tick > 25 && tb < 420 && sim.rng.chance(persona.aggression)) {
        const sx = b.x - ((target.x - b.x) / tb) * 40;
        const sy = b.y - ((target.y - b.y) / tb) * 40;
        const sd = Math.hypot(sx - e.x, sy - e.y) || 1;
        gx = sd > 20 ? (sx - e.x) / sd : (target.x - b.x) / tb;
        gy = sd > 20 ? (sy - e.y) / sd : (target.y - b.y) / tb;
        break;
      }
    }
  } else if (!inDanger) {
    brain.wander += sim.rng.range(-0.5, 0.5);
    gx = Math.cos(brain.wander);
    gy = Math.sin(brain.wander);
  }
  // trapped with a bomb about to go: shield
  if (inDanger && soonest < 12 && e.cooldowns[1] === 0 && sim.rng.chance(persona.skill)) out.skill2 = true;
  const W = BOMBER_CONFIG.width;
  if (e.x < 120) gx += 1;
  if (e.y < 120) gy += 1;
  if (e.x > W - 120) gx -= 1;
  if (e.y > W - 120) gy -= 1;
  out.cashout = sim.stakeOf(e) >= persona.cashoutAt && !inDanger && td > 300;
  let dx = gx + fx;
  let dy = gy + fy;
  const m = Math.hypot(dx, dy);
  if (m > 0.01) {
    dx /= Math.max(1, m);
    dy /= Math.max(1, m);
  }
  out.dx = dx;
  out.dy = dy;
  return { seq: sim.tick, ...out };
}
