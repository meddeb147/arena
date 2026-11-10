import { clamp, type PlayerInput } from '@arena/shared';
import { isProtected, type BotPersona, type Sim } from '../../types';
import { TANK, TANK_CONFIG } from './config';
import type { Tank, TankBrain, TankState } from './types';

type S = Sim<Tank, TankState>;

export function createTankBrain(sim: S): TankBrain {
  return { nextThink: sim.tick, out: { dx: 0, dy: 0, skill1: false, skill2: false, cashout: false }, orbit: sim.rng.chance(0.5) ? 1 : -1 };
}

/** Tank bot: circle-strafe a target at gun range, dodge shells, avoid mines and walls, fetch repairs. */
export function tankBotInput(sim: S, e: Tank, brain: TankBrain, persona: BotPersona): PlayerInput {
  const out = brain.out;
  out.skill1 = false;
  out.skill2 = false;
  if (sim.tick < brain.nextThink) return { seq: sim.tick, ...out };
  brain.nextThink = sim.tick + Math.round(clamp(7 - persona.skill * 5, 2, 7)) + sim.rng.int(0, 2);
  let gx = 0;
  let gy = 0;
  let target: Tank | null = null;
  let best = Infinity;
  let nearest = Infinity;
  for (const o of sim.entities.values()) {
    if (o === e || !o.alive) continue;
    const d = Math.hypot(o.x - e.x, o.y - e.y);
    nearest = Math.min(nearest, d);
    if (isProtected(sim, o) || o.effects[1] > 0) continue;
    const score = d * (0.5 + o.hp / TANK.maxHp);
    if (score < best) {
      best = score;
      target = o;
    }
  }
  const hurt = e.hp < 35 + (1 - persona.aggression) * 20;
  if (hurt && sim.state.kits.length) {
    let k = sim.state.kits[0]!;
    for (const kk of sim.state.kits) if (Math.hypot(kk.x - e.x, kk.y - e.y) < Math.hypot(k.x - e.x, k.y - e.y)) k = kk;
    const d = Math.hypot(k.x - e.x, k.y - e.y) || 1;
    gx = (k.x - e.x) / d;
    gy = (k.y - e.y) / d;
  } else if (target) {
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = 300 + (1 - persona.aggression) * 150;
    const radial = (d - want) / 200;
    gx = (dx / d) * radial + (-dy / d) * brain.orbit;
    gy = (dy / d) * radial + (dx / d) * brain.orbit;
    if (sim.rng.chance(0.02)) brain.orbit *= -1;
  }
  // dodge incoming shells sideways
  let threat = false;
  for (const s of sim.state.shells) {
    if (s.owner === e.id) continue;
    const rx = e.x - s.x;
    const ry = e.y - s.y;
    const sp = Math.hypot(s.vx, s.vy) || 1;
    const along = (rx * s.vx + ry * s.vy) / sp;
    if (along < 0 || along > 260) continue;
    const side = (rx * -s.vy + ry * s.vx) / sp;
    if (Math.abs(side) < e.r + 20) {
      threat = true;
      const sgn = side >= 0 ? 1 : -1;
      gx += (-s.vy / sp) * sgn * 2;
      gy += (s.vx / sp) * sgn * 2;
    }
  }
  for (const m of sim.state.mines) {
    if (m.respawnAt) continue;
    const d = Math.hypot(e.x - m.x, e.y - m.y) || 1;
    if (d < 170) {
      gx += ((e.x - m.x) / d) * 3;
      gy += ((e.y - m.y) / d) * 3;
    }
  }
  for (const c of sim.state.crates) {
    const d = Math.hypot(e.x - c.x, e.y - c.y) || 1;
    if (d < c.r + e.r + 30) {
      gx += (e.x - c.x) / d;
      gy += (e.y - c.y) / d;
    }
  }
  const m = 160;
  if (e.x < m) gx += 1.5;
  if (e.y < m) gy += 1.5;
  if (e.x > TANK_CONFIG.width - m) gx -= 1.5;
  if (e.y > TANK_CONFIG.height - m) gy -= 1.5;
  if (threat && e.hp < 60 && e.cooldowns[1] === 0 && sim.rng.chance(persona.skill)) out.skill2 = true;
  else if (threat && e.cooldowns[0] === 0 && sim.rng.chance(persona.skill * 0.4)) out.skill1 = true;
  out.cashout = sim.stakeOf(e) >= persona.cashoutAt && nearest > 420 && e.hp > 45;
  const len = Math.hypot(gx, gy);
  out.dx = len > 0.01 ? gx / Math.max(1, len) : 0;
  out.dy = len > 0.01 ? gy / Math.max(1, len) : 0;
  return { seq: sim.tick, ...out };
}
