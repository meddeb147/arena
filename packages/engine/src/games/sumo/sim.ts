import { EntFlag, type EntitySnap } from '@arena/shared';
import { isProtected, type BaseEntity, type GameModule, type Sim } from '../../types';
import { SUMO, SUMO_CONFIG, SUMO_CX, SUMO_CY, SumoKind, platformAt } from './config';
import { createSumoBrain, sumoBotInput } from './bot';
import type { SumoBrain, SumoState, Wrestler } from './types';

export type SumoSim = Sim<Wrestler, SumoState>;

const RAM = 0;
const HEAVY = 1;
export const isRamming = (e: Wrestler): boolean => e.effects[RAM] > 0;
export const isHeavy = (e: Wrestler): boolean => e.effects[HEAVY] > 0;
const massOf = (e: Wrestler) => (isHeavy(e) ? SUMO.heavyMass : 1);

function touch(sim: SumoSim, victim: Wrestler, by: Wrestler): void {
  victim.lastHit = { by: by.id, tick: sim.tick };
}

export const sumoGame: GameModule<Wrestler, SumoState, SumoBrain> = {
  config: SUMO_CONFIG,

  createState(init) {
    return {
      bumpers: Array.from({ length: SUMO.bumperCount }, () => ({ id: init.newId(), x: SUMO_CX, y: SUMO_CY, r: SUMO.bumperRadius })),
      platformId: init.newId(),
      radius: SUMO.maxRadius,
      lastSnap: false,
    };
  },

  createEntity(base: BaseEntity, sim) {
    const r = sim.state.radius * 0.7;
    let best = { x: SUMO_CX, y: SUMO_CY };
    let bestScore = -1;
    for (let i = 0; i < 12; i++) {
      const a = sim.rng.range(0, Math.PI * 2);
      const d = Math.sqrt(sim.rng.next()) * r;
      const p = { x: SUMO_CX + Math.cos(a) * d, y: SUMO_CY + Math.sin(a) * d };
      let score = Infinity;
      for (const o of sim.entities.values()) if (o.alive) score = Math.min(score, Math.hypot(o.x - p.x, o.y - p.y));
      for (const b of sim.state.bumpers) score = Math.min(score, Math.hypot(b.x - p.x, b.y - p.y) - 80);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return { ...base, ...best, r: SUMO.radius, angle: Math.atan2(SUMO_CY - best.y, SUMO_CX - best.x), ramX: 0, ramY: 0, falling: 0 };
  },

  useSkill(_sim, e, slot) {
    if (slot === RAM) {
      let dx = e.input.dx;
      let dy = e.input.dy;
      let m = Math.hypot(dx, dy);
      if (m < 0.1) {
        dx = Math.cos(e.angle);
        dy = Math.sin(e.angle);
        m = 1;
      }
      e.ramX = dx / m;
      e.ramY = dy / m;
      e.vx = e.ramX * SUMO.ramSpeed;
      e.vy = e.ramY * SUMO.ramSpeed;
    }
    return true;
  },

  step(sim) {
    const { state, dt, tick } = sim;
    const plat = platformAt(tick);
    state.radius = plat.r;
    const all: Wrestler[] = [];
    for (const e of sim.entities.values()) if (e.alive) all.push(e);

    // the snap-back: a shockwave shoves everyone out from the centre
    if (plat.snapping && !state.lastSnap) {
      sim.emit({ t: 'fx', kind: 'snap', x: SUMO_CX, y: SUMO_CY });
      for (const e of all) {
        const d = Math.hypot(e.x - SUMO_CX, e.y - SUMO_CY) || 1;
        const k = SUMO.shockwave / massOf(e);
        e.vx += ((e.x - SUMO_CX) / d) * k;
        e.vy += ((e.y - SUMO_CY) / d) * k;
      }
    }
    state.lastSnap = plat.snapping;

    // bumpers orbit the centre
    state.bumpers.forEach((b, i) => {
      const a = (i / state.bumpers.length) * Math.PI * 2 + tick * dt * SUMO.bumperSpin;
      b.x = SUMO_CX + Math.cos(a) * SUMO.bumperOrbit;
      b.y = SUMO_CY + Math.sin(a) * SUMO.bumperOrbit;
    });

    // movement: steer with acceleration, slide with friction
    for (const e of all) {
      if (e.falling > 0) continue;
      const heavy = isHeavy(e);
      let max = SUMO.maxSpeed * (heavy ? SUMO.heavySpeedMul : 1) * (e.cashoutTicks > 0 ? SUMO.cashoutSpeedMul : 1);
      if (!isRamming(e)) {
        e.vx += e.input.dx * SUMO.accel * dt;
        e.vy += e.input.dy * SUMO.accel * dt;
      } else max = SUMO.ramSpeed;
      const f = Math.exp(-SUMO.friction * dt);
      e.vx *= f;
      e.vy *= f;
      // steering can't exceed max speed, but knockback can
      const sp = Math.hypot(e.vx, e.vy);
      if (sp > max * 2.6) {
        e.vx *= (max * 2.6) / sp;
        e.vy *= (max * 2.6) / sp;
      }
      if (Math.hypot(e.input.dx, e.input.dy) > 0.15) e.angle = Math.atan2(e.input.dy, e.input.dx);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }

    // wrestler collisions: bouncy, and the harder hitter marks the other
    for (let i = 0; i < all.length; i++) {
      const a = all[i]!;
      if (a.falling) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j]!;
        if (b.falling) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r;
        if (d >= min) continue;
        const nx = dx / d;
        const ny = dy / d;
        const ma = massOf(a);
        const mb = massOf(b);
        // separate
        const push = (min - d) / (ma + mb);
        a.x -= nx * push * mb;
        a.y -= ny * push * mb;
        b.x += nx * push * ma;
        b.y += ny * push * ma;
        // impulse along the normal
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv > 0) continue;
        const ramA = isRamming(a) ? SUMO.ramPushMul : 1;
        const ramB = isRamming(b) ? SUMO.ramPushMul : 1;
        const jImp = (-(1 + SUMO.restitution) * rv) / (1 / ma + 1 / mb);
        const extra = SUMO.bumpImpulse;
        const protA = isProtected(sim, a);
        const protB = isProtected(sim, b);
        if (!protA) {
          a.vx -= ((jImp * ramB + extra * ramB) / ma) * nx;
          a.vy -= ((jImp * ramB + extra * ramB) / ma) * ny;
        }
        if (!protB) {
          b.vx += ((jImp * ramA + extra * ramA) / mb) * nx;
          b.vy += ((jImp * ramA + extra * ramA) / mb) * ny;
        }
        touch(sim, a, b);
        touch(sim, b, a);
        const hard = ramA > 1 || ramB > 1 || -rv > 400;
        sim.emit({ t: 'fx', kind: hard ? 'smash' : 'bump', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, id: ramA > 1 ? a.id : ramB > 1 ? b.id : undefined, v: Math.round(-rv) });
      }
    }

    // bumpers: pinball kick
    for (const e of all) {
      if (e.falling) continue;
      for (const b of state.bumpers) {
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d >= e.r + b.r) continue;
        const nx = dx / d;
        const ny = dy / d;
        e.x = b.x + nx * (e.r + b.r);
        e.y = b.y + ny * (e.r + b.r);
        const k = SUMO.bumperKick / massOf(e);
        e.vx = nx * k;
        e.vy = ny * k;
        sim.emit({ t: 'fx', kind: 'bumper', x: b.x + nx * b.r, y: b.y + ny * b.r, id: e.id });
      }
    }

    // off the edge: fall, then the last toucher gets the kill
    for (const e of all) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - SUMO_CX, e.y - SUMO_CY);
      if (e.falling === 0 && d > plat.r + e.r * 0.35) {
        if (isProtected(sim, e)) {
          // a fresh spawn is placed back on the mat instead
          const k = (plat.r * 0.8) / d;
          e.x = SUMO_CX + (e.x - SUMO_CX) * k;
          e.y = SUMO_CY + (e.y - SUMO_CY) * k;
          e.vx = e.vy = 0;
          continue;
        }
        e.falling = 1;
        sim.emit({ t: 'fx', kind: 'fall', x: e.x, y: e.y, id: e.id });
      }
      if (e.falling > 0) {
        e.falling++;
        e.x += e.vx * dt * 0.6;
        e.y += e.vy * dt * 0.6;
        if (e.falling > 12) {
          const by = e.lastHit && tick - e.lastHit.tick <= SUMO.creditWindow ? sim.entities.get(e.lastHit.by) : undefined;
          const killer = by && by.alive && by !== e && !by.falling ? by : null;
          sim.kill(e, killer, killer ? 'player' : 'hazard');
        }
      }
    }
  },

  createBrain: createSumoBrain,
  botInput: sumoBotInput,

  snapshot(sim, _viewer, cx, cy) {
    const R = SUMO_CONFIG.viewRadius;
    const out: EntitySnap[] = [];
    const plat = platformAt(sim.tick);
    out.push({ id: sim.state.platformId, k: SumoKind.Platform, x: SUMO_CX, y: SUMO_CY, r: Math.round(plat.r), p: plat.phase });
    for (const b of sim.state.bumpers) out.push({ id: b.id, k: SumoKind.Bumper, x: Math.round(b.x), y: Math.round(b.y), r: b.r });
    for (const e of sim.entities.values()) {
      if (!e.alive || Math.abs(e.x - cx) > R || Math.abs(e.y - cy) > R) continue;
      let f = 0;
      if (isRamming(e)) f |= EntFlag.Dash;
      if (isHeavy(e)) f |= EntFlag.Shield;
      out.push({ id: e.id, k: SumoKind.Fighter, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, r: e.r, a: Math.round(e.angle * 100) / 100, c: e.color, f, h: e.falling ? Math.max(0, 1 - e.falling / 12) : 1 });
    }
    return out;
  },
};
