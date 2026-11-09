import { clamp, type PlayerInput } from '@arena/shared';
import { isProtected, type BotPersona, type Sim } from '../../types';
import { BLOB, BLOB_CONFIG } from './config';
import type { BlobBrain, BlobCell, BlobState, Pellet } from './types';

type S = Sim<BlobCell, BlobState>;

export function createBlobBrain(sim: S, _e: BlobCell, _p: BotPersona): BlobBrain {
  return {
    nextThink: sim.tick,
    out: { dx: 0, dy: 0, skill1: false, skill2: false, cashout: false },
    wander: sim.rng.range(0, Math.PI * 2),
  };
}

/**
 * Steering-behaviour bot: flee threats, avoid traps when big, chase prey,
 * otherwise graze. Re-plans every few ticks (slower for weaker bots) so it
 * reacts like a human, not a perfect machine.
 */
export function blobBotInput(sim: S, e: BlobCell, brain: BlobBrain, persona: BotPersona): PlayerInput {
  const out = brain.out;
  // skill presses last a single tick so the room sees a fresh edge next time
  out.skill1 = false;
  out.skill2 = false;
  if (sim.tick < brain.nextThink) return { seq: sim.tick, ...out };
  brain.nextThink = sim.tick + Math.round(clamp(9 - persona.skill * 7, 2, 9)) + sim.rng.int(0, 2);

  let fx = 0;
  let fy = 0;
  let threatGap = Infinity;
  let prey: BlobCell | null = null;
  let preyScore = 0;
  // timid bots want a bigger size edge before they hunt
  const huntRatio = 1.3 + (1 - persona.aggression) * 0.7;

  for (const o of sim.entities.values()) {
    if (o === e || !o.alive) continue;
    const dx = o.x - e.x;
    const dy = o.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const gap = d - o.r - e.r;
    if (o.mass >= e.mass * BLOB.eatRatio && gap < 420) {
      const w = 1 - Math.max(0, gap) / 420;
      fx -= (dx / d) * w * 4;
      fy -= (dy / d) * w * 4;
      threatGap = Math.min(threatGap, gap);
    } else if (e.mass >= o.mass * huntRatio && d < 650 && o.effects[1] === 0 && !isProtected(sim, o)) {
      const score = (o.mass / d) * (0.5 + persona.aggression);
      if (score > preyScore) {
        preyScore = score;
        prey = o;
      }
    }
  }

  // avoid traps that could pop us
  for (const t of sim.state.traps) {
    if (e.r < t.r * BLOB.trapPopRatio) continue;
    const dx = t.x - e.x;
    const dy = t.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const gap = d - t.r - e.r;
    if (gap < 140) {
      const w = 1 - Math.max(0, gap) / 140;
      fx -= (dx / d) * w * 5;
      fy -= (dy / d) * w * 5;
    }
  }

  // walls
  const m = 160;
  const { width, height } = BLOB_CONFIG;
  if (e.x < m) fx += (m - e.x) / m;
  if (e.x > width - m) fx -= (e.x - (width - m)) / m;
  if (e.y < m) fy += (m - e.y) / m;
  if (e.y > height - m) fy -= (e.y - (height - m)) / m;

  const threatened = threatGap < 220;

  // goal
  let gx = 0;
  let gy = 0;
  if (prey && !threatened) {
    const d = Math.hypot(prey.x - e.x, prey.y - e.y) || 1;
    gx = (prey.x - e.x) / d;
    gy = (prey.y - e.y) / d;
    if (d - e.r < 170 && e.cooldowns[0] === 0 && e.mass >= BLOB.dashMinMass * 1.4 && sim.rng.chance(persona.skill * persona.aggression)) {
      out.skill1 = true;
    }
  } else {
    let best: Pellet | null = null;
    let bestD = Infinity;
    sim.state.grid.query(e.x, e.y, 320 + e.r, (p) => {
      const d = Math.hypot(p.x - e.x, p.y - e.y) / p.mass;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    });
    const b = best as Pellet | null;
    if (b) {
      const d = Math.hypot(b.x - e.x, b.y - e.y) || 1;
      gx = (b.x - e.x) / d;
      gy = (b.y - e.y) / d;
    } else {
      brain.wander += sim.rng.range(-0.6, 0.6);
      gx = Math.cos(brain.wander);
      gy = Math.sin(brain.wander);
    }
  }

  // defensive skills
  if (threatened) {
    if (threatGap < 45 && e.cooldowns[1] === 0 && sim.rng.chance(persona.skill)) out.skill2 = true;
    else if (threatGap < 110 && e.cooldowns[0] === 0 && e.mass >= BLOB.dashMinMass && sim.rng.chance(persona.skill * 0.7)) out.skill1 = true;
  }

  // cash out when rich and nobody is around; abort if someone shows up
  const stake = sim.stakeOf(e);
  out.cashout = stake >= persona.cashoutAt && threatGap > 500;

  let dx = fx + gx;
  let dy = fy + gy;
  const mag = Math.hypot(dx, dy);
  if (mag > 0.001) {
    dx /= mag;
    dy /= mag;
  }
  out.dx = dx;
  out.dy = dy;
  return { seq: sim.tick, ...out };
}
