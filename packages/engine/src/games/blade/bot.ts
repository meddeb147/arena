import { clamp, type PlayerInput } from '@arena/shared';
import { isProtected, type BotPersona, type Sim } from '../../types';
import { BLADE_CONFIG, bladeLength } from './config';
import type { BladeBrain, BladeOrb, BladeState, Spinner } from './types';

type S = Sim<Spinner, BladeState>;

export function createBladeBrain(sim: S): BladeBrain {
  return { nextThink: sim.tick, out: { dx: 0, dy: 0, skill1: false, skill2: false, cashout: false }, wander: sim.rng.range(0, 6.28) };
}

/** Blade bot: farm orbs, stay out of longer blades, swoop on shorter ones, avoid lava. */
export function bladeBotInput(sim: S, e: Spinner, brain: BladeBrain, persona: BotPersona): PlayerInput {
  const out = brain.out;
  out.skill1 = false;
  out.skill2 = false;
  if (sim.tick < brain.nextThink) return { seq: sim.tick, ...out };
  brain.nextThink = sim.tick + Math.round(clamp(7 - persona.skill * 5, 2, 7)) + sim.rng.int(0, 2);
  const myL = bladeLength(e.orbs);
  let fx = 0;
  let fy = 0;
  let gx = 0;
  let gy = 0;
  let danger = Infinity;
  let prey: Spinner | null = null;
  let preyD = Infinity;
  for (const o of sim.entities.values()) {
    if (o === e || !o.alive) continue;
    const d = Math.hypot(o.x - e.x, o.y - e.y) || 1;
    const theirReach = bladeLength(o.orbs) + o.r + e.r + 40;
    if (d < theirReach + 120) {
      const w = (1 - (d - theirReach) / 160) * (bladeLength(o.orbs) > myL + 20 ? 3 : 1.2);
      if (w > 0) {
        fx -= ((o.x - e.x) / d) * w;
        fy -= ((o.y - e.y) / d) * w;
      }
      danger = Math.min(danger, d - theirReach);
    }
    if (!isProtected(sim, o) && o.effects[1] === 0 && myL > bladeLength(o.orbs) - 10 && d < 650 && d < preyD) {
      preyD = d;
      prey = o;
    }
  }
  for (const l of sim.state.lava) {
    const d = Math.hypot(e.x - l.x, e.y - l.y) || 1;
    if (d < l.r + e.r + 140) {
      fx += ((e.x - l.x) / d) * 4;
      fy += ((e.y - l.y) / d) * 4;
    }
  }
  const W = BLADE_CONFIG.width;
  if (e.x < 150) fx += 2;
  if (e.y < 150) fy += 2;
  if (e.x > W - 150) fx -= 2;
  if (e.y > W - 150) fy -= 2;
  if (prey && persona.aggression > 0.35) {
    // get the blade tip, not the body, onto them: orbit at blade distance
    const dx = prey.x - e.x;
    const dy = prey.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const radial = (d - (myL * 0.75 + e.r)) / 120;
    gx = (dx / d) * radial + (-dy / d) * 0.6;
    gy = (dy / d) * radial + (dx / d) * 0.6;
  } else {
    let best: BladeOrb | null = null;
    let bd = Infinity;
    sim.state.grid.query(e.x, e.y, 380, (o) => {
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    });
    const b = best as BladeOrb | null;
    if (b) {
      gx = (b.x - e.x) / (bd || 1);
      gy = (b.y - e.y) / (bd || 1);
    } else {
      brain.wander += sim.rng.range(-0.5, 0.5);
      gx = Math.cos(brain.wander);
      gy = Math.sin(brain.wander);
    }
  }
  if (danger < 30 && e.cooldowns[1] === 0 && sim.rng.chance(persona.skill)) out.skill2 = true;
  else if (danger < 60 && e.cooldowns[0] === 0 && sim.rng.chance(persona.skill * 0.5)) out.skill1 = true;
  out.cashout = sim.stakeOf(e) >= persona.cashoutAt && danger > 300;
  let dx = gx + fx;
  let dy = gy + fy;
  const m = Math.hypot(dx, dy);
  if (m > 0.01) {
    dx /= m;
    dy /= m;
  }
  out.dx = dx;
  out.dy = dy;
  return { seq: sim.tick, ...out };
}
