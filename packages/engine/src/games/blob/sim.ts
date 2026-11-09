import { clamp, type DeathCause, type EntitySnap, EntFlag } from '@arena/shared';
import { SpatialGrid } from '../../spatial';
import { isProtected, type BaseEntity, type GameModule, type Sim, type StateInit } from '../../types';
import { BLOB, BLOB_CONFIG, BlobKind, radiusFor, speedFor } from './config';
import { blobBotInput, createBlobBrain } from './bot';
import type { BlobBrain, BlobCell, BlobState, Pellet, Trap } from './types';

export type BlobSim = Sim<BlobCell, BlobState>;

const SHIELD = 1;
const DASH = 0;

export const isShielded = (e: BlobCell): boolean => e.effects[SHIELD] > 0;
export const isDashing = (e: BlobCell): boolean => e.effects[DASH] > 0;

function addPellet(state: BlobState, p: Pellet): void {
  state.pellets.set(p.id, p);
  state.grid.insert(p);
  if (p.vx !== 0 || p.vy !== 0) state.moving.add(p);
}

function removePellet(state: BlobState, p: Pellet): void {
  state.pellets.delete(p.id);
  state.grid.remove(p);
  state.moving.delete(p);
}

function spawnPellet(sim: { rng: StateInit['rng']; newId(): number }, state: BlobState): void {
  const { width, height } = BLOB_CONFIG;
  const big = sim.rng.chance(BLOB.bigPelletChance);
  addPellet(state, {
    id: sim.newId(),
    x: sim.rng.range(20, width - 20),
    y: sim.rng.range(20, height - 20),
    mass: big ? 5 : 1,
    hue: sim.rng.int(0, 5),
    vx: 0,
    vy: 0,
  });
}

/** Scatter mass around a point as drifting pellets. */
function ejectMass(sim: BlobSim, x: number, y: number, mass: number, spread: number, dirX = 0, dirY = 0): void {
  let left = Math.floor(mass);
  while (left > 0) {
    const m = Math.min(left, sim.rng.int(2, 4));
    left -= m;
    const a = sim.rng.range(0, Math.PI * 2);
    const sp = sim.rng.range(0.4, 1) * spread;
    addPellet(sim.state, {
      id: sim.newId(),
      x: clamp(x, 5, BLOB_CONFIG.width - 5),
      y: clamp(y, 5, BLOB_CONFIG.height - 5),
      mass: m,
      hue: sim.rng.int(0, 5),
      vx: Math.cos(a) * sp + dirX,
      vy: Math.sin(a) * sp + dirY,
    });
  }
}

/** Pick the spawn point furthest from anything dangerous out of a few candidates. */
function safeSpawn(sim: BlobSim): { x: number; y: number } {
  const { width, height } = BLOB_CONFIG;
  let best = { x: width / 2, y: height / 2 };
  let bestScore = -Infinity;
  for (let i = 0; i < 16; i++) {
    const x = sim.rng.range(150, width - 150);
    const y = sim.rng.range(150, height - 150);
    let score = Infinity;
    for (const o of sim.entities.values()) {
      if (!o.alive) continue;
      score = Math.min(score, Math.hypot(o.x - x, o.y - y) - o.r);
    }
    for (const t of sim.state.traps) score = Math.min(score, Math.hypot(t.x - x, t.y - y) - t.r - 60);
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  return best;
}

function setMass(e: BlobCell, m: number): void {
  e.mass = clamp(m, 1, BLOB.maxMass);
  e.r = radiusFor(e.mass);
}

export const blobGame: GameModule<BlobCell, BlobState, BlobBrain> = {
  config: BLOB_CONFIG,

  createState(init) {
    const { width, height } = init.config;
    const state: BlobState = {
      pellets: new Map(),
      grid: new SpatialGrid<Pellet>(width, height, BLOB.gridCell),
      moving: new Set(),
      traps: [],
    };
    for (let i = 0; i < BLOB.trapCount; i++) {
      const cx = init.rng.range(300, width - 300);
      const cy = init.rng.range(300, height - 300);
      const t: Trap = {
        id: init.newId(),
        x: cx,
        y: cy,
        r: BLOB.trapRadius,
        a: 0,
        spin: init.rng.range(1.2, 2.4) * (init.rng.chance(0.5) ? 1 : -1),
        cx,
        cy,
        orbitR: init.rng.range(0, 140),
        orbitSpeed: init.rng.range(0.1, 0.3) * (init.rng.chance(0.5) ? 1 : -1),
        phase: init.rng.range(0, Math.PI * 2),
      };
      state.traps.push(t);
    }
    for (let i = 0; i < BLOB.pelletTarget; i++) spawnPellet(init, state);
    return state;
  },

  createEntity(base: BaseEntity, sim) {
    const p = safeSpawn(sim);
    const e: BlobCell = { ...base, x: p.x, y: p.y, mass: BLOB.spawnMass, dashX: 0, dashY: 0 };
    setMass(e, BLOB.spawnMass);
    return e;
  },

  useSkill(sim, e, slot) {
    if (slot === DASH) {
      if (e.mass < BLOB.dashMinMass) return false;
      let dx = e.input.dx;
      let dy = e.input.dy;
      let m = Math.hypot(dx, dy);
      if (m < 0.1) {
        dx = e.vx;
        dy = e.vy;
        m = Math.hypot(dx, dy);
      }
      if (m < 0.01) {
        dx = Math.cos(e.angle);
        dy = Math.sin(e.angle);
        m = 1;
      }
      e.dashX = dx / m;
      e.dashY = dy / m;
      const cost = Math.max(2, Math.floor(e.mass * BLOB.dashMassCost));
      setMass(e, e.mass - cost);
      // the spent mass is left behind as a snack for others
      ejectMass(sim, e.x - e.dashX * e.r, e.y - e.dashY * e.r, cost / 2, 60, -e.dashX * 120, -e.dashY * 120);
      return true;
    }
    return true; // shield: always available off cooldown
  },

  step(sim) {
    const { state, dt } = sim;
    const { width, height } = BLOB_CONFIG;
    const t = sim.tick * dt;

    // traps orbit and spin
    for (const tr of state.traps) {
      tr.a += tr.spin * dt;
      tr.x = tr.cx + Math.cos(tr.phase + t * tr.orbitSpeed) * tr.orbitR;
      tr.y = tr.cy + Math.sin(tr.phase + t * tr.orbitSpeed) * tr.orbitR;
    }

    // drifting pellets
    const damp = Math.pow(0.04, dt);
    for (const p of state.moving) {
      const ox = p.x;
      const oy = p.y;
      p.x = clamp(p.x + p.vx * dt, 5, width - 5);
      p.y = clamp(p.y + p.vy * dt, 5, height - 5);
      p.vx *= damp;
      p.vy *= damp;
      state.grid.move(p, ox, oy);
      if (Math.abs(p.vx) + Math.abs(p.vy) < 4) {
        p.vx = 0;
        p.vy = 0;
        state.moving.delete(p);
      }
    }

    const cells: BlobCell[] = [];
    for (const e of sim.entities.values()) if (e.alive) cells.push(e);

    // movement
    for (const e of cells) {
      let speed = speedFor(e.mass);
      if (e.cashoutTicks > 0) speed *= BLOB.cashoutSpeedMul;
      let tvx: number;
      let tvy: number;
      if (isDashing(e)) {
        tvx = e.dashX * speed * BLOB.dashSpeedMul;
        tvy = e.dashY * speed * BLOB.dashSpeedMul;
        e.vx = tvx;
        e.vy = tvy;
      } else {
        tvx = e.input.dx * speed;
        tvy = e.input.dy * speed;
        const k = Math.min(1, 9 * dt);
        e.vx += (tvx - e.vx) * k;
        e.vy += (tvy - e.vy) * k;
      }
      e.x = clamp(e.x + e.vx * dt, e.r * 0.5, width - e.r * 0.5);
      e.y = clamp(e.y + e.vy * dt, e.r * 0.5, height - e.r * 0.5);
      if (Math.abs(e.vx) + Math.abs(e.vy) > 1) e.angle = Math.atan2(e.vy, e.vx);
      if (e.mass > BLOB.decayAboveMass) setMass(e, e.mass - e.mass * BLOB.decayPerSecond * dt);
    }

    // eat pellets
    for (const e of cells) {
      let gained = 0;
      const eaten: Pellet[] = [];
      state.grid.query(e.x, e.y, e.r, (p) => {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        if (dx * dx + dy * dy < e.r * e.r) {
          eaten.push(p);
          gained += p.mass;
        }
      });
      for (const p of eaten) removePellet(state, p);
      if (gained > 0) setMass(e, e.mass + gained);
    }

    // cells eat cells (bigger first, so chains resolve consistently)
    cells.sort((a, b) => b.mass - a.mass || a.id - b.id);
    for (let i = 0; i < cells.length; i++) {
      const a = cells[i]!;
      if (!a.alive || isShielded(a) || isProtected(sim, a)) continue;
      for (let j = i + 1; j < cells.length; j++) {
        const b = cells[j]!;
        if (!b.alive || isShielded(b) || isProtected(sim, b)) continue;
        if (a.mass < b.mass * BLOB.eatRatio) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < a.r - b.r * BLOB.eatOverlap) {
          setMass(a, a.mass + b.mass);
          sim.kill(b, a, 'player');
        }
      }
    }

    // spike traps pop cells that are bigger than them
    for (const e of cells) {
      if (!e.alive || isShielded(e) || isProtected(sim, e)) continue;
      for (const tr of state.traps) {
        if (e.r < tr.r * BLOB.trapPopRatio) continue;
        const d = Math.hypot(e.x - tr.x, e.y - tr.y);
        if (d < e.r - tr.r * 0.25) {
          sim.kill(e, null, 'hazard');
          break;
        }
      }
    }

    // keep the buffet stocked
    for (let i = 0; i < BLOB.pelletSpawnPerTick && state.pellets.size < BLOB.pelletTarget; i++) spawnPellet(sim, state);
  },

  onDeath(sim, e, cause: DeathCause) {
    // eaten cells were absorbed; anything else bursts into pellets
    if (cause !== 'player') ejectMass(sim, e.x, e.y, e.mass * BLOB.trapDropFraction, Math.min(500, 150 + e.r * 2));
  },

  createBrain: createBlobBrain,
  botInput: blobBotInput,

  snapshot(sim, viewer, cx, cy) {
    const R = BLOB_CONFIG.viewRadius + (viewer ? viewer.r * 2.5 : 0);
    const out: EntitySnap[] = [];
    const r1 = (v: number) => Math.round(v * 10) / 10;
    for (const e of sim.entities.values()) {
      if (!e.alive) continue;
      if (Math.abs(e.x - cx) > R + e.r || Math.abs(e.y - cy) > R + e.r) continue;
      let f = 0;
      if (isShielded(e)) f |= EntFlag.Shield;
      if (isDashing(e)) f |= EntFlag.Dash;
      out.push({ id: e.id, k: BlobKind.Cell, x: r1(e.x), y: r1(e.y), r: r1(e.r), a: r1(e.angle), c: e.color, f });
    }
    for (const t of sim.state.traps) {
      if (Math.abs(t.x - cx) > R + t.r || Math.abs(t.y - cy) > R + t.r) continue;
      out.push({ id: t.id, k: BlobKind.Trap, x: r1(t.x), y: r1(t.y), r: t.r, a: Math.round(t.a * 100) / 100 });
    }
    sim.state.grid.query(cx, cy, R, (p) => {
      out.push({ id: p.id, k: BlobKind.Pellet, x: Math.round(p.x), y: Math.round(p.y), r: p.mass > 1 ? 9 : 5, c: p.hue });
    });
    return out;
  },
};
