import { EntFlag, type DeathCause, type EntitySnap } from '@arena/shared';
import { SpatialGrid } from '../../spatial';
import { isProtected, type BaseEntity, type GameModule, type Sim, type StateInit } from '../../types';
import { BLADE, BLADE_CONFIG, BladeKind, bladeLength } from './config';
import { bladeBotInput, createBladeBrain } from './bot';
import type { BladeBrain, BladeOrb, BladeState, Spinner } from './types';

export type BladeSim = Sim<Spinner, BladeState>;
const DASH = 0;
const SHIELD = 1;
export const bladeShielded = (e: Spinner) => e.effects[SHIELD] > 0;
const dashing = (e: Spinner) => e.effects[DASH] > 0;

/** The two blade segments of a spinner: [x1, y1, x2, y2] each. */
export function blades(e: Spinner): [number, number, number, number][] {
  const L = bladeLength(e.orbs);
  const out: [number, number, number, number][] = [];
  for (const k of [0, Math.PI]) {
    const a = e.spinAngle + k;
    const c = Math.cos(a);
    const s = Math.sin(a);
    out.push([e.x + c * (e.r + 4), e.y + s * (e.r + 4), e.x + c * (e.r + 4 + L), e.y + s * (e.r + 4 + L)]);
  }
  return out;
}

function segPointDist(x1: number, y1: number, x2: number, y2: number, px: number, py: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(x1 + dx * t - px, y1 + dy * t - py);
}
function segSegClose(a: number[], b: number[], tol: number): { x: number; y: number } | null {
  // sample-based closest approach (cheap and robust enough for 2 short segments)
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const px = a[0]! + (a[2]! - a[0]!) * t;
    const py = a[1]! + (a[3]! - a[1]!) * t;
    if (segPointDist(b[0]!, b[1]!, b[2]!, b[3]!, px, py) < tol) return { x: px, y: py };
  }
  return null;
}

function addOrb(state: BladeState, o: BladeOrb): void {
  state.orbs.set(o.id, o);
  state.grid.insert(o);
}
function spawnOrb(sim: { rng: StateInit['rng']; newId(): number }, state: BladeState, x?: number, y?: number, v = 1): void {
  addOrb(state, { id: sim.newId(), x: x ?? sim.rng.range(60, BLADE_CONFIG.width - 60), y: y ?? sim.rng.range(60, BLADE_CONFIG.height - 60), v });
}

export const bladeGame: GameModule<Spinner, BladeState, BladeBrain> = {
  config: BLADE_CONFIG,

  createState(init) {
    const state: BladeState = { orbs: new Map(), grid: new SpatialGrid(BLADE_CONFIG.width, BLADE_CONFIG.height, 128), lava: [], clash: new Map() };
    for (let i = 0; i < BLADE.lavaCount; i++) {
      const cx = init.rng.range(400, BLADE_CONFIG.width - 400);
      const cy = init.rng.range(400, BLADE_CONFIG.height - 400);
      state.lava.push({ id: init.newId(), x: cx, y: cy, r: init.rng.range(80, 135), cx, cy, orbitR: init.rng.range(40, 160), speed: init.rng.range(0.1, 0.25) * (init.rng.chance(0.5) ? 1 : -1), phase: init.rng.range(0, 6.28) });
    }
    for (let i = 0; i < BLADE.orbTarget; i++) spawnOrb(init, state);
    return state;
  },

  createEntity(base: BaseEntity, sim) {
    let best = { x: 1500, y: 1500 };
    let bestScore = -Infinity;
    for (let i = 0; i < 16; i++) {
      const p = { x: sim.rng.range(250, BLADE_CONFIG.width - 250), y: sim.rng.range(250, BLADE_CONFIG.height - 250) };
      let score = Infinity;
      for (const o of sim.entities.values()) if (o.alive) score = Math.min(score, Math.hypot(o.x - p.x, o.y - p.y) - bladeLength(o.orbs));
      for (const l of sim.state.lava) score = Math.min(score, Math.hypot(l.x - p.x, l.y - p.y) - l.r - 100);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return { ...base, ...best, r: BLADE.radius, orbs: 0, spinAngle: sim.rng.range(0, 6.28), spinDir: sim.rng.chance(0.5) ? 1 : -1, dashX: 0, dashY: 0, kvx: 0, kvy: 0 };
  },

  useSkill(_sim, e, slot) {
    if (slot === DASH) {
      const m = Math.hypot(e.input.dx, e.input.dy);
      e.dashX = m > 0.1 ? e.input.dx / m : Math.cos(e.angle);
      e.dashY = m > 0.1 ? e.input.dy / m : Math.sin(e.angle);
    }
    return true;
  },

  step(sim) {
    const { state, dt, tick } = sim;
    const t = tick * dt;
    for (const l of state.lava) {
      l.x = l.cx + Math.cos(l.phase + t * l.speed) * l.orbitR;
      l.y = l.cy + Math.sin(l.phase + t * l.speed) * l.orbitR;
    }
    const alive: Spinner[] = [];
    for (const e of sim.entities.values()) if (e.alive) alive.push(e);
    const kd = Math.exp(-BLADE.knockDamp * dt);

    for (const e of alive) {
      e.spinAngle += BLADE.spin * e.spinDir * dt;
      const L = bladeLength(e.orbs);
      let speed = BLADE.speed * (1 - L * BLADE.slowPerLength) * (e.cashoutTicks > 0 ? BLADE.cashoutSpeedMul : 1);
      if (dashing(e)) {
        speed *= BLADE.dashMul;
        e.vx = e.dashX * speed;
        e.vy = e.dashY * speed;
      } else {
        const k = Math.min(1, BLADE.steerRate * dt);
        e.vx += (e.input.dx * speed - e.vx) * k;
        e.vy += (e.input.dy * speed - e.vy) * k;
      }
      if (Math.hypot(e.vx, e.vy) > 10) e.angle = Math.atan2(e.vy, e.vx);
      e.x = Math.max(e.r, Math.min(BLADE_CONFIG.width - e.r, e.x + (e.vx + e.kvx) * dt));
      e.y = Math.max(e.r, Math.min(BLADE_CONFIG.height - e.r, e.y + (e.vy + e.kvy) * dt));
      e.kvx *= kd;
      e.kvy *= kd;
    }

    // eat orbs (body or blades)
    for (const e of alive) {
      const eaten: BladeOrb[] = [];
      state.grid.query(e.x, e.y, e.r + 14, (o) => {
        if (Math.hypot(o.x - e.x, o.y - e.y) < e.r + 10) eaten.push(o);
      });
      for (const o of eaten) {
        state.orbs.delete(o.id);
        state.grid.remove(o);
        e.orbs += o.v;
      }
    }

    // blade clashes: sparks and both spinners are thrown apart
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i]!;
      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j]!;
        const reach = bladeLength(a.orbs) + bladeLength(b.orbs) + a.r + b.r + 10;
        if (Math.abs(a.x - b.x) > reach || Math.abs(a.y - b.y) > reach) continue;
        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if ((state.clash.get(key) ?? 0) > tick) continue;
        let hit: { x: number; y: number } | null = null;
        for (const sa of blades(a)) {
          for (const sb of blades(b)) {
            hit = segSegClose(sa, sb, 8);
            if (hit) break;
          }
          if (hit) break;
        }
        if (!hit) continue;
        state.clash.set(key, tick + BLADE.clashCooldown);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        a.kvx -= (dx / d) * BLADE.clashKnock;
        a.kvy -= (dy / d) * BLADE.clashKnock;
        b.kvx += (dx / d) * BLADE.clashKnock;
        b.kvy += (dy / d) * BLADE.clashKnock;
        a.spinDir = a.spinDir === 1 ? -1 : 1;
        b.spinDir = b.spinDir === 1 ? -1 : 1;
        a.lastHit = { by: b.id, tick };
        b.lastHit = { by: a.id, tick };
        sim.emit({ t: 'fx', kind: 'clash', x: hit.x, y: hit.y });
      }
    }
    if (tick % 300 === 0) for (const [k, until] of state.clash) if (until < tick) state.clash.delete(k);

    // a blade through a body is fatal
    for (const a of alive) {
      if (!a.alive || isProtected(sim, a)) continue;
      const segs = blades(a);
      for (const b of alive) {
        if (b === a || !b.alive || isProtected(sim, b) || bladeShielded(b)) continue;
        if (segs.some((s) => segPointDist(s[0], s[1], s[2], s[3], b.x, b.y) < b.r)) {
          sim.emit({ t: 'fx', kind: 'slice', x: b.x, y: b.y, id: a.id });
          sim.kill(b, a, 'player');
        }
      }
    }

    // lava: the last spinner to clash with you gets the kill
    for (const e of alive) {
      if (!e.alive || isProtected(sim, e) || bladeShielded(e)) continue;
      for (const l of state.lava) {
        if (Math.hypot(e.x - l.x, e.y - l.y) < l.r - e.r * 0.3) {
          const by = e.lastHit && tick - e.lastHit.tick <= BLADE.creditWindow ? sim.entities.get(e.lastHit.by) : undefined;
          const killer = by && by.alive && by !== e ? by : null;
          sim.emit({ t: 'fx', kind: 'lava', x: e.x, y: e.y });
          sim.kill(e, killer, killer ? 'player' : 'hazard');
          break;
        }
      }
    }

    for (let i = 0; i < BLADE.orbSpawnPerTick && state.orbs.size < BLADE.orbTarget; i++) spawnOrb(sim, state);
  },

  onDeath(sim, e, _cause: DeathCause) {
    const n = Math.min(40, Math.floor(e.orbs * BLADE.dropFraction));
    for (let i = 0; i < n; i++) {
      const a = sim.rng.range(0, Math.PI * 2);
      const d = sim.rng.range(10, 60 + n * 3);
      spawnOrb(sim, sim.state, Math.max(20, Math.min(BLADE_CONFIG.width - 20, e.x + Math.cos(a) * d)), Math.max(20, Math.min(BLADE_CONFIG.height - 20, e.y + Math.sin(a) * d)), 1);
    }
  },

  createBrain: createBladeBrain,
  botInput: bladeBotInput,

  snapshot(sim, _viewer, cx, cy) {
    const R = BLADE_CONFIG.viewRadius;
    const out: EntitySnap[] = [];
    for (const e of sim.entities.values()) {
      if (!e.alive || Math.abs(e.x - cx) > R + 250 || Math.abs(e.y - cy) > R + 250) continue;
      let f = 0;
      if (bladeShielded(e)) f |= EntFlag.Shield;
      if (dashing(e)) f |= EntFlag.Dash;
      // blade angle in `a`, blade length in `h` (world units / 1000)
      out.push({ id: e.id, k: BladeKind.Spinner, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, r: e.r, a: Math.round(e.spinAngle * 100) / 100, c: e.color, f, h: Math.round(bladeLength(e.orbs)) / 1000 });
    }
    for (const l of sim.state.lava) if (Math.abs(l.x - cx) < R + l.r && Math.abs(l.y - cy) < R + l.r) out.push({ id: l.id, k: BladeKind.Lava, x: Math.round(l.x), y: Math.round(l.y), r: Math.round(l.r) });
    sim.state.grid.query(cx, cy, R, (o) => {
      out.push({ id: o.id, k: BladeKind.Orb, x: Math.round(o.x), y: Math.round(o.y), r: 6 });
    });
    return out;
  },
};
