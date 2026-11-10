import { EntFlag, type EntitySnap } from '@arena/shared';
import { isProtected, type BaseEntity, type GameModule, type Sim } from '../../types';
import { APOTHEM, ARENA_CX, ARENA_CY, VOLT, VOLT_CONFIG, VoltKind, WALL_NORMALS, strikeInterval } from './config';
import { createVoltBrain, voltBotInput } from './bot';
import type { VoltBrain, VoltFighter, VoltState } from './types';

export type VoltSim = Sim<VoltFighter, VoltState>;

const DASH = 0;
const SHIELD = 1;
export const isShielded = (e: VoltFighter): boolean => e.effects[SHIELD] > 0;
export const isDashing = (e: VoltFighter): boolean => e.effects[DASH] > 0;

/** Random point inside the cage (the inscribed circle is fully inside the octagon). */
function randomPoint(sim: { rng: VoltSim['rng'] }, maxFrac = 0.92): { x: number; y: number } {
  const a = sim.rng.range(0, Math.PI * 2);
  const d = Math.sqrt(sim.rng.next()) * APOTHEM * maxFrac;
  return { x: ARENA_CX + Math.cos(a) * d, y: ARENA_CY + Math.sin(a) * d };
}

/**
 * Deal damage. Shield and spawn protection block it. `attacker` (if any)
 * becomes the last hitter, who gets the kill if the victim dies within the
 * credit window, even when lightning or a pylon finishes them off.
 */
export function damage(sim: VoltSim, v: VoltFighter, amount: number, attacker: VoltFighter | null, kx: number, ky: number, knock: number): void {
  if (!v.alive) return;
  if (isProtected(sim, v)) return;
  if (isShielded(v)) {
    v.kvx += kx * knock * VOLT.shieldKnockMul;
    v.kvy += ky * knock * VOLT.shieldKnockMul;
    sim.emit({ t: 'fx', kind: 'block', x: v.x, y: v.y, id: v.id });
    return;
  }
  v.kvx += kx * knock;
  v.kvy += ky * knock;
  v.hp -= amount;
  v.lastDamagedTick = sim.tick;
  if (attacker && attacker !== v) v.lastHit = { by: attacker.id, tick: sim.tick };
  if (v.hp <= 0) {
    v.hp = 0;
    const credited = v.lastHit && sim.tick - v.lastHit.tick <= VOLT.creditWindow ? sim.entities.get(v.lastHit.by) : undefined;
    const killer = credited && credited.alive && credited !== v ? credited : null;
    if (killer) killer.hp = Math.min(VOLT.maxHp, killer.hp + VOLT.healOnKill);
    sim.kill(v, killer, killer ? 'player' : 'hazard');
  }
}

function recentAttacker(sim: VoltSim, e: VoltFighter): VoltFighter | null {
  if (!e.lastHit || sim.tick - e.lastHit.tick > VOLT.creditWindow) return null;
  return sim.entities.get(e.lastHit.by) ?? null;
}

function spawnPoint(sim: VoltSim): { x: number; y: number } {
  let best = randomPoint(sim, 0.8);
  let bestScore = -Infinity;
  for (let i = 0; i < 14; i++) {
    const p = randomPoint(sim, 0.8);
    let score = Infinity;
    for (const o of sim.entities.values()) if (o.alive) score = Math.min(score, Math.hypot(o.x - p.x, o.y - p.y));
    for (const s of sim.state.strikes) score = Math.min(score, Math.hypot(s.x - p.x, s.y - p.y) - s.r);
    for (const py of sim.state.pylons) score = Math.min(score, Math.hypot(py.x - p.x, py.y - p.y) - 120);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export const voltGame: GameModule<VoltFighter, VoltState, VoltBrain> = {
  config: VOLT_CONFIG,

  createState(init) {
    const pylons = Array.from({ length: 4 }, (_, k) => {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      return { id: init.newId(), x: ARENA_CX + Math.cos(a) * VOLT.pylonDistance, y: ARENA_CY + Math.sin(a) * VOLT.pylonDistance, r: VOLT.pylonRadius };
    });
    const orbs = Array.from({ length: 4 }, () => ({ id: init.newId(), ...randomPoint(init) }));
    return { strikes: [], pylons, orbs, nextStrike: 60, nextOrb: VOLT.orbEvery };
  },

  createEntity(base: BaseEntity, sim) {
    const p = spawnPoint(sim);
    return {
      ...base,
      x: p.x,
      y: p.y,
      r: VOLT.radius,
      angle: Math.atan2(ARENA_CY - p.y, ARENA_CX - p.x),
      hp: VOLT.maxHp,
      jabCd: 0,
      punchTicks: 0,
      dashX: 0,
      dashY: 0,
      dashHit: [],
      kvx: 0,
      kvy: 0,
      zapCd: 0,
      lastDamagedTick: -1e9,
    };
  },

  useSkill(_sim, e, slot) {
    if (slot === DASH) {
      let dx = e.input.dx;
      let dy = e.input.dy;
      let m = Math.hypot(dx, dy);
      if (m < 0.1) {
        dx = Math.cos(e.angle);
        dy = Math.sin(e.angle);
        m = 1;
      }
      e.dashX = dx / m;
      e.dashY = dy / m;
      e.dashHit = [];
      e.angle = Math.atan2(e.dashY, e.dashX);
    }
    return true;
  },

  step(sim) {
    const { state, dt, tick } = sim;
    const alive: VoltFighter[] = [];
    for (const e of sim.entities.values()) if (e.alive) alive.push(e);

    // --- hazards: lightning ------------------------------------------------
    if (tick >= state.nextStrike) {
      state.nextStrike = tick + strikeInterval(alive.length) + sim.rng.int(0, 12);
      let p = randomPoint(sim);
      if (alive.length && sim.rng.chance(VOLT.strikeAim)) {
        const t = sim.rng.pick(alive);
        const a = sim.rng.range(0, Math.PI * 2);
        const j = sim.rng.range(0, 120);
        p = { x: t.x + Math.cos(a) * j, y: t.y + Math.sin(a) * j };
      }
      state.strikes.push({ id: sim.newId(), x: p.x, y: p.y, r: VOLT.strikeRadius, fireTick: tick + VOLT.strikeWarn });
    }
    for (const s of state.strikes) {
      if (s.fireTick !== tick) continue;
      sim.emit({ t: 'fx', kind: 'bolt', x: s.x, y: s.y });
      for (const e of alive) {
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d < s.r + e.r * 0.5) damage(sim, e, VOLT.strikeDamage, null, d > 1 ? dx / d : 1, d > 1 ? dy / d : 0, VOLT.strikeKnock);
      }
    }
    state.strikes = state.strikes.filter((s) => tick < s.fireTick + VOLT.strikeShow);

    // --- orbs ----------------------------------------------------------------
    if (tick >= state.nextOrb) {
      state.nextOrb = tick + VOLT.orbEvery;
      if (state.orbs.length < VOLT.orbMax) state.orbs.push({ id: sim.newId(), ...randomPoint(sim) });
    }

    // --- movement --------------------------------------------------------------
    const kd = Math.exp(-VOLT.knockDamp * dt);
    for (const e of alive) {
      if (e.jabCd > 0) e.jabCd--;
      if (e.punchTicks > 0) e.punchTicks--;
      if (e.zapCd > 0) e.zapCd--;
      let speed = VOLT.speed * (e.cashoutTicks > 0 ? VOLT.cashoutSpeedMul : 1);
      if (isDashing(e)) {
        speed *= VOLT.dashSpeedMul;
        e.vx = e.dashX * speed;
        e.vy = e.dashY * speed;
      } else {
        const k = Math.min(1, VOLT.steerRate * dt);
        e.vx += (e.input.dx * speed - e.vx) * k;
        e.vy += (e.input.dy * speed - e.vy) * k;
        if (Math.hypot(e.input.dx, e.input.dy) > 0.15) e.angle = Math.atan2(e.input.dy, e.input.dx);
      }
      e.x += (e.vx + e.kvx) * dt;
      e.y += (e.vy + e.kvy) * dt;
      e.kvx *= kd;
      e.kvy *= kd;

      // the cage: bounce off each flat wall, slams hurt
      for (const [nx, ny] of WALL_NORMALS) {
        const over = (e.x - ARENA_CX) * nx + (e.y - ARENA_CY) * ny + e.r - APOTHEM;
        if (over <= 0) continue;
        e.x -= nx * over;
        e.y -= ny * over;
        const vn = e.kvx * nx + e.kvy * ny;
        if (vn > 0) {
          e.kvx -= (1 + VOLT.wallBounce) * vn * nx;
          e.kvy -= (1 + VOLT.wallBounce) * vn * ny;
          if (vn > VOLT.slamSpeed) {
            sim.emit({ t: 'fx', kind: 'slam', x: e.x + nx * e.r, y: e.y + ny * e.r, v: Math.round(vn) });
            damage(sim, e, VOLT.slamDamage, recentAttacker(sim, e), -nx, -ny, 0);
          }
        }
        const sv = e.vx * nx + e.vy * ny;
        if (sv > 0) {
          e.vx -= sv * nx;
          e.vy -= sv * ny;
        }
      }
    }

    // --- pylons: solid, and they zap ----------------------------------------
    for (const e of alive) {
      if (!e.alive) continue;
      for (const p of state.pylons) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const min = e.r + p.r;
        if (d >= min) continue;
        const nx = dx / d;
        const ny = dy / d;
        e.x = p.x + nx * min;
        e.y = p.y + ny * min;
        if (e.zapCd === 0) {
          e.zapCd = VOLT.pylonCooldown;
          sim.emit({ t: 'fx', kind: 'zap', x: p.x + nx * p.r, y: p.y + ny * p.r, id: e.id });
          damage(sim, e, VOLT.pylonDamage, recentAttacker(sim, e), nx, ny, VOLT.pylonKnock);
        }
      }
    }

    // --- fighters push each other apart -------------------------------------
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i]!;
      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r;
        if (d >= min) continue;
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }

    // --- dash hits -----------------------------------------------------------
    for (const a of alive) {
      if (!a.alive || !isDashing(a)) continue;
      for (const b of alive) {
        if (b === a || !b.alive || a.dashHit.includes(b.id)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > a.r + b.r + 8) continue;
        a.dashHit.push(b.id);
        a.punchTicks = VOLT.punchAnim;
        sim.emit({ t: 'fx', kind: 'smash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, id: a.id });
        damage(sim, b, VOLT.dashDamage, a, dx / d, dy / d, VOLT.dashKnock);
      }
    }

    // --- automatic jabs at the nearest fighter in reach ------------------------
    for (const a of alive) {
      if (!a.alive || a.jabCd > 0 || a.cashoutTicks > 0 || isProtected(sim, a)) continue;
      let target: VoltFighter | null = null;
      let best = Infinity;
      for (const b of alive) {
        if (b === a || !b.alive) continue;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < a.r + b.r + VOLT.jabReach && d < best) {
          best = d;
          target = b;
        }
      }
      if (!target) continue;
      const dx = (target.x - a.x) / (best || 1);
      const dy = (target.y - a.y) / (best || 1);
      a.angle = Math.atan2(dy, dx);
      a.jabCd = VOLT.jabCooldown;
      a.punchTicks = VOLT.punchAnim;
      sim.emit({ t: 'fx', kind: 'hit', x: a.x + dx * a.r, y: a.y + dy * a.r, id: a.id });
      damage(sim, target, VOLT.jabDamage, a, dx, dy, VOLT.jabKnock);
    }

    // --- orbs heal, regen ------------------------------------------------------
    for (const e of alive) {
      if (!e.alive) continue;
      for (let i = state.orbs.length - 1; i >= 0; i--) {
        const o = state.orbs[i]!;
        if (Math.hypot(o.x - e.x, o.y - e.y) < e.r + VOLT.orbRadius && e.hp < VOLT.maxHp) {
          e.hp = Math.min(VOLT.maxHp, e.hp + VOLT.orbHeal);
          state.orbs.splice(i, 1);
          sim.emit({ t: 'fx', kind: 'orb', x: o.x, y: o.y, id: e.id });
        }
      }
      if (tick - e.lastDamagedTick > VOLT.regenDelay) e.hp = Math.min(VOLT.maxHp, e.hp + VOLT.regenPerSecond * dt);
    }
  },

  createBrain: createVoltBrain,
  botInput: voltBotInput,

  snapshot(sim, _viewer, cx, cy) {
    const R = VOLT_CONFIG.viewRadius;
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const out: EntitySnap[] = [];
    for (const e of sim.entities.values()) {
      if (!e.alive || Math.abs(e.x - cx) > R || Math.abs(e.y - cy) > R) continue;
      let f = 0;
      if (isShielded(e)) f |= EntFlag.Shield;
      if (isDashing(e)) f |= EntFlag.Dash;
      if (e.punchTicks > 0) f |= EntFlag.Attack;
      out.push({ id: e.id, k: VoltKind.Fighter, x: r1(e.x), y: r1(e.y), r: e.r, a: Math.round(e.angle * 100) / 100, c: e.color, f, h: Math.round((e.hp / VOLT.maxHp) * 100) / 100 });
    }
    for (const s of sim.state.strikes) {
      const fired = sim.tick >= s.fireTick;
      const p = fired ? 1 : 1 - (s.fireTick - sim.tick) / VOLT.strikeWarn;
      out.push({ id: s.id, k: fired ? VoltKind.Bolt : VoltKind.Strike, x: r1(s.x), y: r1(s.y), r: s.r, p: Math.round(p * 100) / 100 });
    }
    for (const p of sim.state.pylons) out.push({ id: p.id, k: VoltKind.Pylon, x: p.x, y: p.y, r: p.r });
    for (const o of sim.state.orbs) out.push({ id: o.id, k: VoltKind.Orb, x: Math.round(o.x), y: Math.round(o.y), r: VOLT.orbRadius });
    return out;
  },
};
