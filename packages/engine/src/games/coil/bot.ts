import { clamp, type PlayerInput } from '@arena/shared';
import { isProtected, type BotPersona, type Sim } from '../../types';
import { COIL, COIL_CONFIG, lengthFor } from './config';
import type { CoilBrain, CoilPellet, CoilState, Snake } from './types';

type S = Sim<Snake, CoilState>;

export function createCoilBrain(sim: S): CoilBrain {
  return { nextThink: sim.tick, out: { dx: 1, dy: 0, skill1: false, skill2: false, cashout: false }, wander: sim.rng.range(0, Math.PI * 2) };
}

/**
 * Snake bot: look ahead for bodies, walls and traps and turn away (or jump),
 * graze food, and when long enough try to cut in front of a nearby head.
 */
export function coilBotInput(sim: S, e: Snake, brain: CoilBrain, persona: BotPersona): PlayerInput {
  const out = brain.out;
  out.skill1 = false;
  out.skill2 = false;
  if (sim.tick < brain.nextThink) return { seq: sim.tick, ...out };
  brain.nextThink = sim.tick + Math.round(clamp(6 - persona.skill * 5, 1, 6)) + sim.rng.int(0, 1);

  const fx = Math.cos(e.angle);
  const fy = Math.sin(e.angle);
  const look = 110 + e.r * 3;
  let ax = 0;
  let ay = 0;
  let danger = Infinity;
  const avoid = (x: number, y: number, w: number) => {
    const dx = x - e.x;
    const dy = y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > look * 1.6) return;
    const ahead = (dx * fx + dy * fy) / d;
    if (ahead < -0.2) return;
    const k = (1 - d / (look * 1.6)) * w * (0.5 + ahead);
    ax -= (dx / d) * k;
    ay -= (dy / d) * k;
    if (ahead > 0.5) danger = Math.min(danger, d);
  };
  for (const o of sim.entities.values()) {
    if (o === e || !o.alive) continue;
    if (Math.abs(o.x - e.x) > lengthFor(o.mass) + look * 2 || Math.abs(o.y - e.y) > lengthFor(o.mass) + look * 2) continue;
    for (let i = 0; i < o.body.length; i += 4) avoid(o.body[i]!, o.body[i + 1]!, 1.2);
  }
  for (const t of sim.state.traps) avoid(t.x, t.y, 4);
  const { width, height } = COIL_CONFIG;
  const wall = 220;
  if (e.x < wall) ax += (wall - e.x) / wall * 3;
  if (e.x > width - wall) ax -= (e.x - (width - wall)) / wall * 3;
  if (e.y < wall) ay += (wall - e.y) / wall * 3;
  if (e.y > height - wall) ay -= (e.y - (height - wall)) / wall * 3;

  // goal: cut off a smaller snake's head, otherwise the best food nearby
  let gx = 0;
  let gy = 0;
  let hunting = false;
  if (e.mass > 40 && persona.aggression > 0.4) {
    for (const o of sim.entities.values()) {
      if (o === e || !o.alive || isProtected(sim, o) || o.mass > e.mass) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d > 420) continue;
      const tx = o.x + Math.cos(o.angle) * 120;
      const ty = o.y + Math.sin(o.angle) * 120;
      const dd = Math.hypot(tx - e.x, ty - e.y) || 1;
      gx = (tx - e.x) / dd;
      gy = (ty - e.y) / dd;
      hunting = true;
      break;
    }
  }
  if (!hunting) {
    let best: CoilPellet | null = null;
    let bestScore = 0;
    sim.state.grid.query(e.x + fx * 120, e.y + fy * 120, 360, (p) => {
      const score = (p.mass * (p.golden ? 3 : 1)) / (Math.hypot(p.x - e.x, p.y - e.y) + 30);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    });
    const b = best as CoilPellet | null;
    if (b) {
      const d = Math.hypot(b.x - e.x, b.y - e.y) || 1;
      gx = (b.x - e.x) / d;
      gy = (b.y - e.y) / d;
    } else {
      brain.wander += sim.rng.range(-0.4, 0.4);
      gx = Math.cos(brain.wander);
      gy = Math.sin(brain.wander);
    }
  }

  // jump over a body we are about to hit; magnet when lots of food is around
  if (danger < 60 + e.r && e.cooldowns[0] === 0 && sim.rng.chance(persona.skill)) out.skill1 = true;
  if (e.cooldowns[1] === 0 && sim.rng.chance(0.02 + persona.skill * 0.03)) out.skill2 = true;

  out.cashout = sim.stakeOf(e) >= persona.cashoutAt && danger === Infinity;
  let dx = gx + ax * 1.6;
  let dy = gy + ay * 1.6;
  const m = Math.hypot(dx, dy) || 1;
  dx /= m;
  dy /= m;
  out.dx = dx;
  out.dy = dy;
  return { seq: sim.tick, ...out };
}

export { COIL };
