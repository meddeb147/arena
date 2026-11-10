import { clamp, type PlayerInput } from '@arena/shared';
import { isProtected, type BotPersona, type Sim } from '../../types';
import { POTATO, POTATO_CONFIG } from './config';
import { holding } from './sim';
import type { PotatoBrain, PotatoState, Runner } from './types';

type S = Sim<Runner, PotatoState>;

export function createPotatoBrain(sim: S): PotatoBrain {
  return { nextThink: sim.tick, out: { dx: 0, dy: 0, skill1: false, skill2: false, cashout: false }, wander: sim.rng.range(0, 6.28) };
}

/** Potato bot: holding one, chase the nearest catchable player and dash in; otherwise run from holders. */
export function potatoBotInput(sim: S, e: Runner, brain: PotatoBrain, persona: BotPersona): PlayerInput {
  const out = brain.out;
  out.skill1 = false;
  out.skill2 = false;
  if (sim.tick < brain.nextThink) return { seq: sim.tick, ...out };
  brain.nextThink = sim.tick + Math.round(clamp(6 - persona.skill * 5, 1, 6)) + sim.rng.int(0, 1);
  const mine = sim.state.potatoes.find((p) => p.holder === e.id);
  let gx = 0;
  let gy = 0;
  let nearestHolder = Infinity;
  if (mine) {
    let target: Runner | null = null;
    let td = Infinity;
    for (const o of sim.entities.values()) {
      if (o === e || !o.alive || isProtected(sim, o) || holding(sim.state, o) || o.effects[1] > 0) continue;
      if (mine.immune && mine.immune.id === o.id && sim.tick < mine.immune.until) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < td) {
        td = d;
        target = o;
      }
    }
    if (target) {
      // aim slightly ahead of where they are running
      const tx = target.x + target.vx * 0.25;
      const ty = target.y + target.vy * 0.25;
      const d = Math.hypot(tx - e.x, ty - e.y) || 1;
      gx = (tx - e.x) / d;
      gy = (ty - e.y) / d;
      const left = mine.explodeAt - sim.tick;
      if (d < 220 && e.cooldowns[0] === 0 && sim.rng.chance(persona.skill * (left < 90 ? 1 : 0.5))) out.skill1 = true;
    }
  } else {
    for (const p of sim.state.potatoes) {
      if (p.holder === null) continue;
      const h = sim.entities.get(p.holder);
      if (!h) continue;
      const dx = e.x - h.x;
      const dy = e.y - h.y;
      const d = Math.hypot(dx, dy) || 1;
      nearestHolder = Math.min(nearestHolder, d);
      if (d < 520) {
        const fear = (1 - d / 520) * (1.5 + (1 - (p.explodeAt - sim.tick) / POTATO.fuse));
        gx += (dx / d) * fear * 2;
        gy += (dy / d) * fear * 2;
        if (d < 120 && h.effects[0] > 0 && e.cooldowns[1] === 0 && sim.rng.chance(persona.skill)) out.skill2 = true;
        else if (d < 110 && e.cooldowns[0] === 0 && sim.rng.chance(persona.skill * 0.5)) {
          out.skill1 = true;
          gx = dx / d;
          gy = dy / d;
        }
      }
    }
    if (Math.hypot(gx, gy) < 0.1) {
      brain.wander += sim.rng.range(-0.5, 0.5);
      gx = Math.cos(brain.wander) * 0.5;
      gy = Math.sin(brain.wander) * 0.5;
    }
  }
  const W = POTATO_CONFIG.width;
  const m = 200;
  if (e.x < m) gx += 1.5;
  if (e.y < m) gy += 1.5;
  if (e.x > W - m) gx -= 1.5;
  if (e.y > W - m) gy -= 1.5;
  for (const p of sim.state.pillars) {
    const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
    if (d < p.r + e.r + 40) {
      gx += ((e.x - p.x) / d) * 1.5;
      gy += ((e.y - p.y) / d) * 1.5;
    }
  }
  out.cashout = !mine && sim.stakeOf(e) >= persona.cashoutAt && nearestHolder > 600;
  const len = Math.hypot(gx, gy);
  out.dx = len > 0.01 ? gx / Math.max(1, len) : 0;
  out.dy = len > 0.01 ? gy / Math.max(1, len) : 0;
  return { seq: sim.tick, ...out };
}
