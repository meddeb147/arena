import { EntFlag, type DeathCause, type EntitySnap } from '@arena/shared';
import { SpatialGrid } from '../../spatial';
import { isProtected, type BaseEntity, type GameModule, type Sim, type StateInit } from '../../types';
import { COIL, COIL_CONFIG, CoilKind, lengthFor, radiusFor } from './config';
import { coilBotInput, createCoilBrain } from './bot';
import type { CoilBrain, CoilPellet, CoilState, Snake } from './types';

export type CoilSim = Sim<Snake, CoilState>;

const JUMP = 0;
const MAGNET = 1;
export const isJumping = (e: Snake): boolean => e.effects[JUMP] > 0;
export const hasMagnet = (e: Snake): boolean => e.effects[MAGNET] > 0;

function addPellet(state: CoilState, p: CoilPellet): void {
  state.pellets.set(p.id, p);
  state.grid.insert(p);
}
function removePellet(state: CoilState, p: CoilPellet): void {
  state.pellets.delete(p.id);
  state.grid.remove(p);
}
function spawnPellet(sim: { rng: StateInit['rng']; newId(): number }, state: CoilState, x?: number, y?: number, mass?: number): void {
  const golden = mass === undefined && sim.rng.chance(COIL.goldenChance);
  addPellet(state, {
    id: sim.newId(),
    x: x ?? sim.rng.range(60, COIL_CONFIG.width - 60),
    y: y ?? sim.rng.range(60, COIL_CONFIG.height - 60),
    mass: mass ?? (golden ? 6 : 1),
    hue: sim.rng.int(0, 5),
    golden,
  });
}

/** Total length of a body polyline. */
function trimBody(e: Snake): void {
  const want = lengthFor(e.mass);
  let acc = 0;
  const b = e.body;
  for (let i = 2; i < b.length; i += 2) {
    acc += Math.hypot(b[i]! - b[i - 2]!, b[i + 1]! - b[i - 1]!);
    if (acc > want) {
      b.length = i + 2;
      return;
    }
  }
}

function setMass(e: Snake, m: number): void {
  e.mass = Math.max(1, Math.min(COIL.maxMass, m));
  e.r = radiusFor(e.mass);
}

function safeSpawn(sim: CoilSim): { x: number; y: number } {
  const { width, height } = COIL_CONFIG;
  let best = { x: width / 2, y: height / 2 };
  let bestScore = -Infinity;
  for (let i = 0; i < 18; i++) {
    const x = sim.rng.range(400, width - 400);
    const y = sim.rng.range(400, height - 400);
    let score = Infinity;
    for (const o of sim.entities.values()) {
      if (!o.alive) continue;
      for (let k = 0; k < o.body.length; k += 8) score = Math.min(score, Math.hypot(o.body[k]! - x, o.body[k + 1]! - y));
    }
    for (const t of sim.state.traps) score = Math.min(score, Math.hypot(t.x - x, t.y - y) - 150);
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  return best;
}

export const coilGame: GameModule<Snake, CoilState, CoilBrain> = {
  config: COIL_CONFIG,

  createState(init) {
    const { width, height } = init.config;
    const state: CoilState = { pellets: new Map(), grid: new SpatialGrid<CoilPellet>(width, height, COIL.gridCell), traps: [] };
    for (let i = 0; i < COIL.trapCount; i++) {
      state.traps.push({ id: init.newId(), x: init.rng.range(500, width - 500), y: init.rng.range(500, height - 500), r: COIL.trapRadius, a: 0, spin: init.rng.range(1, 2) * (init.rng.chance(0.5) ? 1 : -1) });
    }
    for (let i = 0; i < COIL.pelletTarget; i++) spawnPellet(init, state);
    return state;
  },

  createEntity(base: BaseEntity, sim) {
    const p = safeSpawn(sim);
    const angle = Math.atan2(COIL_CONFIG.height / 2 - p.y, COIL_CONFIG.width / 2 - p.x);
    const e: Snake = { ...base, x: p.x, y: p.y, angle, mass: COIL.startMass, body: [], sinceLast: 0 };
    setMass(e, COIL.startMass);
    // lay the starting body out behind the head
    const len = lengthFor(e.mass);
    for (let d = 0; d <= len; d += COIL.segSpacing) e.body.push(p.x - Math.cos(angle) * d, p.y - Math.sin(angle) * d);
    return e;
  },

  useSkill() {
    return true;
  },

  step(sim) {
    const { state, dt } = sim;
    const { width, height } = COIL_CONFIG;
    for (const t of state.traps) t.a += t.spin * dt;
    const snakes: Snake[] = [];
    for (const e of sim.entities.values()) if (e.alive) snakes.push(e);

    // steer and move
    for (const e of snakes) {
      const m = Math.hypot(e.input.dx, e.input.dy);
      if (m > 0.1) {
        const target = Math.atan2(e.input.dy, e.input.dx);
        let d = target - e.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const maxTurn = COIL.turnRate * dt * (isJumping(e) ? 0.5 : 1);
        e.angle += Math.max(-maxTurn, Math.min(maxTurn, d));
      }
      const speed = COIL.speed * (e.cashoutTicks > 0 ? COIL.cashoutSpeedMul : 1) * (isJumping(e) ? 1.25 : 1);
      e.vx = Math.cos(e.angle) * speed;
      e.vy = Math.sin(e.angle) * speed;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // record body points
      e.sinceLast += speed * dt;
      if (e.sinceLast >= COIL.segSpacing) {
        e.sinceLast = 0;
        e.body.unshift(e.x, e.y);
      } else {
        e.body[0] = e.x;
        e.body[1] = e.y;
      }
      trimBody(e);
    }

    // walls kill
    for (const e of snakes) {
      if (e.x < COIL.wallMargin || e.y < COIL.wallMargin || e.x > width - COIL.wallMargin || e.y > height - COIL.wallMargin) {
        if (!isProtected(sim, e)) sim.kill(e, null, 'hazard');
        else {
          e.x = Math.max(COIL.wallMargin + 1, Math.min(width - COIL.wallMargin - 1, e.x));
          e.y = Math.max(COIL.wallMargin + 1, Math.min(height - COIL.wallMargin - 1, e.y));
          e.angle += Math.PI;
        }
      }
    }

    // magnet pulls food
    for (const e of snakes) {
      if (!e.alive || !hasMagnet(e)) continue;
      const moved: CoilPellet[] = [];
      state.grid.query(e.x, e.y, COIL.magnetRadius, (p) => {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < COIL.magnetRadius && d > 1) moved.push(p);
      });
      for (const p of moved) {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        const ox = p.x;
        const oy = p.y;
        const step = Math.min(d, COIL.magnetPull * dt);
        p.x -= ((p.x - e.x) / d) * step;
        p.y -= ((p.y - e.y) / d) * step;
        state.grid.move(p, ox, oy);
      }
    }

    // eat
    for (const e of snakes) {
      if (!e.alive || isJumping(e)) continue;
      let gained = 0;
      const eaten: CoilPellet[] = [];
      state.grid.query(e.x, e.y, e.r + 12, (p) => {
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 8) {
          eaten.push(p);
          gained += p.mass;
        }
      });
      for (const p of eaten) {
        removePellet(state, p);
        if (p.golden) sim.emit({ t: 'fx', kind: 'golden', x: p.x, y: p.y, id: e.id });
      }
      if (gained) setMass(e, e.mass + gained);
    }

    // heads hitting bodies: the body's owner gets the kill
    for (const a of snakes) {
      if (!a.alive || isJumping(a) || isProtected(sim, a)) continue;
      let killer: Snake | null = null;
      for (const b of snakes) {
        if (b === a || !b.alive) continue;
        const reach = a.r * 0.75 + b.r;
        // quick reject on the bounding distance
        if (Math.abs(b.x - a.x) > lengthFor(b.mass) + 60 || Math.abs(b.y - a.y) > lengthFor(b.mass) + 60) continue;
        for (let i = COIL.neckSkip * 2; i < b.body.length; i += 2) {
          const dx = b.body[i]! - a.x;
          const dy = b.body[i + 1]! - a.y;
          if (dx * dx + dy * dy < reach * reach) {
            killer = b;
            break;
          }
        }
        if (killer) break;
        // head-on: the smaller one loses
        if (Math.hypot(b.x - a.x, b.y - a.y) < a.r + b.r && !isJumping(b) && b.mass > a.mass) {
          killer = b;
          break;
        }
      }
      if (killer) sim.kill(a, killer, 'player');
    }

    // spike traps: heads only
    for (const e of snakes) {
      if (!e.alive || isJumping(e) || isProtected(sim, e)) continue;
      for (const t of state.traps) {
        if (Math.hypot(t.x - e.x, t.y - e.y) < t.r + e.r * 0.6) {
          sim.kill(e, null, 'hazard');
          break;
        }
      }
    }

    for (let i = 0; i < COIL.pelletSpawnPerTick && state.pellets.size < COIL.pelletTarget; i++) spawnPellet(sim, state);
  },

  onDeath(sim, e, _cause: DeathCause) {
    // the body bursts into a trail of glowing food
    const pts = e.body.length / 2;
    const total = Math.max(6, Math.floor(e.mass * COIL.dropFraction));
    const n = Math.min(pts, Math.max(4, Math.floor(total / 2)));
    const per = Math.max(1, Math.round(total / n));
    for (let k = 0; k < n; k++) {
      const i = Math.floor((k / n) * pts) * 2;
      spawnPellet(sim, sim.state, (e.body[i] ?? e.x) + sim.rng.range(-10, 10), (e.body[i + 1] ?? e.y) + sim.rng.range(-10, 10), per);
    }
  },

  createBrain: createCoilBrain,
  botInput: coilBotInput,

  snapshot(sim, viewer, cx, cy) {
    const R = COIL_CONFIG.viewRadius + (viewer ? viewer.mass * 0.6 : 0);
    const out: EntitySnap[] = [];
    for (const e of sim.entities.values()) {
      if (!e.alive) continue;
      // include if any part of the body is in view
      let inView = false;
      for (let i = 0; i < e.body.length; i += 6) {
        if (Math.abs(e.body[i]! - cx) < R && Math.abs(e.body[i + 1]! - cy) < R) {
          inView = true;
          break;
        }
      }
      if (!inView) continue;
      const pts: number[] = [];
      for (let i = 0; i < e.body.length; i += 4) pts.push(Math.round(e.body[i]!), Math.round(e.body[i + 1]!));
      let f = 0;
      if (isJumping(e)) f |= EntFlag.Jump;
      if (hasMagnet(e)) f |= EntFlag.Magnet;
      out.push({ id: e.id, k: CoilKind.Snake, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, r: Math.round(e.r * 10) / 10, a: Math.round(e.angle * 100) / 100, c: e.color, f, pts });
    }
    for (const t of sim.state.traps) {
      if (Math.abs(t.x - cx) < R && Math.abs(t.y - cy) < R) out.push({ id: t.id, k: CoilKind.Trap, x: t.x, y: t.y, r: t.r, a: Math.round(t.a * 100) / 100 });
    }
    sim.state.grid.query(cx, cy, R, (p) => {
      out.push({ id: p.id, k: CoilKind.Pellet, x: Math.round(p.x), y: Math.round(p.y), r: p.golden ? 10 : p.mass > 1 ? 7 : 4.5, c: p.golden ? -1 : p.hue });
    });
    return out;
  },
};
