import { EntFlag, type EntitySnap } from '@arena/shared';
import { isProtected, type BaseEntity, type GameModule, type Sim } from '../../types';
import { BOMBER, BOMBER_CONFIG, BomberKind } from './config';
import { bomberBotInput, createBomberBrain } from './bot';
import type { Bomb, Bomber, BomberBrain, BomberState } from './types';

export type BomberSim = Sim<Bomber, BomberState>;
const SHIELD = 1;
export const bomberShielded = (e: Bomber) => e.effects[SHIELD] > 0;

function blocked(state: BomberState, x: number, y: number, r: number): boolean {
  return state.pillars.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r);
}

export const bomberGame: GameModule<Bomber, BomberState, BomberBrain> = {
  config: BOMBER_CONFIG,

  createState(init) {
    const pillars = [];
    const S = BOMBER.pillarSpacing;
    for (let x = S; x < BOMBER_CONFIG.width - S / 2; x += S)
      for (let y = S; y < BOMBER_CONFIG.height - S / 2; y += S) pillars.push({ id: init.newId(), x, y, r: BOMBER.pillarRadius });
    return { bombs: [], pillars, marks: [], nextSky: BOMBER.skyEvery };
  },

  createEntity(base: BaseEntity, sim) {
    let best = { x: 300, y: 300 };
    let bestScore = -Infinity;
    for (let i = 0; i < 16; i++) {
      const p = { x: sim.rng.range(120, BOMBER_CONFIG.width - 120), y: sim.rng.range(120, BOMBER_CONFIG.height - 120) };
      if (blocked(sim.state, p.x, p.y, 60)) continue;
      let score = Infinity;
      for (const o of sim.entities.values()) if (o.alive) score = Math.min(score, Math.hypot(o.x - p.x, o.y - p.y));
      for (const b of sim.state.bombs) score = Math.min(score, Math.hypot(b.x - p.x, b.y - p.y) - BOMBER.blast * 1.5);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return { ...base, ...best, r: BOMBER.radius, live: 0 };
  },

  useSkill(sim, e, slot) {
    if (slot !== 0) return true;
    if (e.live >= BOMBER.maxBombs) return false;
    e.live++;
    sim.state.bombs.push({ id: sim.newId(), x: e.x, y: e.y, vx: 0, vy: 0, owner: e.id, fuseAt: sim.tick + BOMBER.fuse, ownerClear: false, bornAt: sim.tick });
    sim.emit({ t: 'fx', kind: 'drop', x: e.x, y: e.y, id: e.id });
    return true;
  },

  step(sim) {
    const { state, dt, tick } = sim;
    const W = BOMBER_CONFIG.width;
    const H = BOMBER_CONFIG.height;
    const alive: Bomber[] = [];
    for (const e of sim.entities.values()) if (e.alive) alive.push(e);

    for (const e of alive) {
      const speed = BOMBER.speed * (e.cashoutTicks > 0 ? BOMBER.cashoutSpeedMul : 1);
      const k = Math.min(1, BOMBER.steerRate * dt);
      e.vx += (e.input.dx * speed - e.vx) * k;
      e.vy += (e.input.dy * speed - e.vy) * k;
      if (Math.hypot(e.vx, e.vy) > 10) e.angle = Math.atan2(e.vy, e.vx);
      e.x = Math.max(e.r, Math.min(W - e.r, e.x + e.vx * dt));
      e.y = Math.max(e.r, Math.min(H - e.r, e.y + e.vy * dt));
      for (const p of state.pillars) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < p.r + e.r) {
          e.x = p.x + (dx / d) * (p.r + e.r);
          e.y = p.y + (dy / d) * (p.r + e.r);
        }
      }
    }

    // bombs: slide, get kicked by walking into them
    const bf = Math.exp(-BOMBER.bombFriction * dt);
    for (const b of state.bombs) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= bf;
      b.vy *= bf;
      if (b.x < BOMBER.bombRadius || b.x > W - BOMBER.bombRadius) b.vx *= -1;
      if (b.y < BOMBER.bombRadius || b.y > H - BOMBER.bombRadius) b.vy *= -1;
      b.x = Math.max(BOMBER.bombRadius, Math.min(W - BOMBER.bombRadius, b.x));
      b.y = Math.max(BOMBER.bombRadius, Math.min(H - BOMBER.bombRadius, b.y));
      for (const p of state.pillars) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < p.r + BOMBER.bombRadius) {
          const nx = dx / d;
          const ny = dy / d;
          b.x = p.x + nx * (p.r + BOMBER.bombRadius);
          b.y = p.y + ny * (p.r + BOMBER.bombRadius);
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            b.vx -= 2 * vn * nx;
            b.vy -= 2 * vn * ny;
          }
        }
      }
      for (const e of alive) {
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (b.owner === e.id && !b.ownerClear) {
          if (d > e.r + BOMBER.bombRadius + 2) b.ownerClear = true;
          continue;
        }
        if (d < e.r + BOMBER.bombRadius) {
          const sp = Math.hypot(e.vx, e.vy);
          const toward = (e.vx * dx + e.vy * dy) / d;
          if (toward > 40) {
            b.vx = (dx / d) * Math.max(BOMBER.kickSpeed, sp * 1.8);
            b.vy = (dy / d) * Math.max(BOMBER.kickSpeed, sp * 1.8);
            sim.emit({ t: 'fx', kind: 'kick', x: b.x, y: b.y, id: e.id });
          }
          e.x = b.x - (dx / d) * (e.r + BOMBER.bombRadius);
          e.y = b.y - (dy / d) * (e.r + BOMBER.bombRadius);
        }
      }
    }

    // sky bombs: a marker, then a bomb lands with a short fuse
    if (tick >= state.nextSky) {
      state.nextSky = tick + BOMBER.skyEvery + sim.rng.int(0, 20);
      const pick = alive.length && sim.rng.chance(0.6) ? sim.rng.pick(alive) : null;
      const x = pick ? pick.x + sim.rng.range(-140, 140) : sim.rng.range(100, W - 100);
      const y = pick ? pick.y + sim.rng.range(-140, 140) : sim.rng.range(100, H - 100);
      if (!blocked(state, x, y, 30)) state.marks.push({ id: sim.newId(), x: Math.max(40, Math.min(W - 40, x)), y: Math.max(40, Math.min(H - 40, y)), dropAt: tick + BOMBER.skyWarn });
    }
    for (const m of state.marks) {
      if (m.dropAt !== tick) continue;
      state.bombs.push({ id: sim.newId(), x: m.x, y: m.y, vx: 0, vy: 0, owner: null, fuseAt: tick + 12, ownerClear: true, bornAt: tick });
      sim.emit({ t: 'fx', kind: 'land', x: m.x, y: m.y });
    }
    state.marks = state.marks.filter((m) => m.dropAt > tick);

    // explosions, with chain reactions
    const exploding = state.bombs.filter((b) => b.fuseAt <= tick);
    if (exploding.length) {
      state.bombs = state.bombs.filter((b) => b.fuseAt > tick);
      for (const b of exploding) {
        const owner = b.owner !== null ? sim.entities.get(b.owner) : undefined;
        if (owner) owner.live = Math.max(0, owner.live - 1);
        sim.emit({ t: 'fx', kind: 'blast', x: b.x, y: b.y, id: b.owner ?? undefined });
        for (const o of state.bombs) if (Math.hypot(o.x - b.x, o.y - b.y) < BOMBER.blast) o.fuseAt = Math.min(o.fuseAt, tick + BOMBER.chainDelay);
        for (const e of alive) {
          if (!e.alive || isProtected(sim, e) || bomberShielded(e)) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) > BOMBER.blast + e.r * 0.5) continue;
          if (owner && owner === e) sim.kill(e, null, 'self');
          else sim.kill(e, owner && owner.alive ? owner : null, owner ? 'player' : 'hazard');
        }
      }
    }
    // bombs whose owner left keep ticking; keep counters honest
    for (const e of alive) e.live = Math.min(e.live, state.bombs.filter((b) => b.owner === e.id).length);
  },

  onRemove(sim, e) {
    for (const b of sim.state.bombs) if (b.owner === e.id) b.owner = null;
  },

  createBrain: createBomberBrain,
  botInput: bomberBotInput,

  snapshot(sim, _viewer, cx, cy) {
    const R = BOMBER_CONFIG.viewRadius;
    const near = (x: number, y: number) => Math.abs(x - cx) < R && Math.abs(y - cy) < R;
    const out: EntitySnap[] = [];
    for (const e of sim.entities.values()) {
      if (!e.alive || !near(e.x, e.y)) continue;
      let f = 0;
      if (bomberShielded(e)) f |= EntFlag.Shield;
      out.push({ id: e.id, k: BomberKind.Player, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, r: e.r, a: Math.round(e.angle * 100) / 100, c: e.color, f });
    }
    for (const b of sim.state.bombs) {
      if (!near(b.x, b.y)) continue;
      const left = Math.max(0, b.fuseAt - sim.tick);
      const total = Math.max(1, b.fuseAt - b.bornAt);
      out.push({ id: b.id, k: BomberKind.Bomb, x: Math.round(b.x), y: Math.round(b.y), r: BOMBER.bombRadius, h: Math.round((left / total) * 100) / 100, c: b.owner === null ? -1 : (sim.entities.get(b.owner)?.color ?? -1) });
    }
    for (const p of sim.state.pillars) if (near(p.x, p.y)) out.push({ id: p.id, k: BomberKind.Pillar, x: p.x, y: p.y, r: p.r });
    for (const m of sim.state.marks) if (near(m.x, m.y)) out.push({ id: m.id, k: BomberKind.SkyMark, x: Math.round(m.x), y: Math.round(m.y), r: BOMBER.blast, h: Math.round((1 - (m.dropAt - sim.tick) / BOMBER.skyWarn) * 100) / 100 });
    return out;
  },
};
