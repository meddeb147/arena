import { EntFlag, type EntitySnap } from '@arena/shared';
import { isProtected, type BaseEntity, type GameModule, type Sim, type StateInit } from '../../types';
import { TANK, TANK_CONFIG, TankKind } from './config';
import { createTankBrain, tankBotInput } from './bot';
import type { Crate, Tank, TankBrain, TankState } from './types';

export type TankSim = Sim<Tank, TankState>;
const DASH = 0;
const SHIELD = 1;
export const tankShielded = (e: Tank) => e.effects[SHIELD] > 0;
const dashing = (e: Tank) => e.effects[DASH] > 0;

function freeSpot(sim: { rng: StateInit['rng'] }, crates: Crate[], margin = 120): { x: number; y: number } {
  for (let i = 0; i < 30; i++) {
    const x = sim.rng.range(margin, TANK_CONFIG.width - margin);
    const y = sim.rng.range(margin, TANK_CONFIG.height - margin);
    if (crates.every((c) => Math.hypot(c.x - x, c.y - y) > c.r + 70)) return { x, y };
  }
  return { x: TANK_CONFIG.width / 2, y: TANK_CONFIG.height / 2 };
}

/** Damage with kill credit: the last hitter within the window gets the stake. */
export function tankDamage(sim: TankSim, v: Tank, amount: number, attacker: Tank | null, kx: number, ky: number, knock: number): void {
  if (!v.alive || isProtected(sim, v)) return;
  if (tankShielded(v)) {
    sim.emit({ t: 'fx', kind: 'block', x: v.x, y: v.y, id: v.id });
    return;
  }
  v.kvx += kx * knock;
  v.kvy += ky * knock;
  v.hp -= amount;
  v.lastDamagedTick = sim.tick;
  if (attacker && attacker !== v) v.lastHit = { by: attacker.id, tick: sim.tick };
  if (v.hp > 0) return;
  const by = v.lastHit && sim.tick - v.lastHit.tick <= TANK.creditWindow ? sim.entities.get(v.lastHit.by) : undefined;
  const killer = by && by.alive && by !== v ? by : null;
  if (killer) killer.hp = Math.min(TANK.maxHp, killer.hp + TANK.healOnKill);
  sim.kill(v, killer, killer ? 'player' : 'hazard');
}

export const tankGame: GameModule<Tank, TankState, TankBrain> = {
  config: TANK_CONFIG,

  createState(init) {
    const crates: Crate[] = [];
    for (let i = 0; i < TANK.crateCount; i++) {
      const p = freeSpot(init, crates, 220);
      crates.push({ id: init.newId(), ...p, r: init.rng.range(44, 78) });
    }
    const mines = Array.from({ length: TANK.mineCount }, () => ({ id: init.newId(), ...freeSpot(init, crates), armedAt: 0, respawnAt: 0 }));
    const kits = Array.from({ length: 3 }, () => ({ id: init.newId(), ...freeSpot(init, crates) }));
    return { shells: [], crates, mines, kits, nextKit: TANK.kitEvery };
  },

  createEntity(base: BaseEntity, sim) {
    let best = freeSpot(sim, sim.state.crates);
    let bestScore = -1;
    for (let i = 0; i < 12; i++) {
      const p = freeSpot(sim, sim.state.crates, 200);
      let score = Infinity;
      for (const o of sim.entities.values()) if (o.alive) score = Math.min(score, Math.hypot(o.x - p.x, o.y - p.y));
      for (const m of sim.state.mines) score = Math.min(score, Math.hypot(m.x - p.x, m.y - p.y) * 3);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return { ...base, ...best, r: TANK.radius, hp: TANK.maxHp, turret: 0, fireCd: 0, dashX: 0, dashY: 0, kvx: 0, kvy: 0, lastDamagedTick: -1e9, firing: 0 };
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
    const W = TANK_CONFIG.width;
    const H = TANK_CONFIG.height;
    const alive: Tank[] = [];
    for (const e of sim.entities.values()) if (e.alive) alive.push(e);
    const kd = Math.exp(-TANK.knockDamp * dt);

    for (const e of alive) {
      if (e.fireCd > 0) e.fireCd--;
      if (e.firing > 0) e.firing--;
      let speed = TANK.speed * (e.cashoutTicks > 0 ? TANK.cashoutSpeedMul : 1);
      if (dashing(e)) {
        e.vx = e.dashX * speed * TANK.dashMul;
        e.vy = e.dashY * speed * TANK.dashMul;
      } else {
        const k = Math.min(1, TANK.steerRate * dt);
        e.vx += (e.input.dx * speed - e.vx) * k;
        e.vy += (e.input.dy * speed - e.vy) * k;
      }
      if (Math.hypot(e.vx, e.vy) > 20) {
        // the hull turns toward where it drives
        const target = Math.atan2(e.vy, e.vx);
        let d = target - e.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        e.angle += Math.max(-6 * dt, Math.min(6 * dt, d));
      }
      e.x = Math.max(e.r, Math.min(W - e.r, e.x + (e.vx + e.kvx) * dt));
      e.y = Math.max(e.r, Math.min(H - e.r, e.y + (e.vy + e.kvy) * dt));
      e.kvx *= kd;
      e.kvy *= kd;
      for (const c of state.crates) {
        const dx = e.x - c.x;
        const dy = e.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < c.r + e.r) {
          e.x = c.x + (dx / d) * (c.r + e.r);
          e.y = c.y + (dy / d) * (c.r + e.r);
        }
      }
    }
    // tanks push each other apart
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i]!;
        const b = alive[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= a.r + b.r) continue;
        const p = (a.r + b.r - d) / 2;
        a.x -= (dx / d) * p;
        a.y -= (dy / d) * p;
        b.x += (dx / d) * p;
        b.y += (dy / d) * p;
      }

    // turrets auto-aim at the nearest enemy and fire when lined up
    for (const e of alive) {
      if (!e.alive) continue;
      let target: Tank | null = null;
      let bd: number = TANK.range;
      for (const o of alive) {
        if (o === e || !o.alive || isProtected(sim, o)) continue;
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < bd) {
          bd = d;
          target = o;
        }
      }
      const want = target ? Math.atan2(target.y - e.y, target.x - e.x) : e.angle;
      let d = want - e.turret;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      e.turret += Math.max(-TANK.turretTurn * dt, Math.min(TANK.turretTurn * dt, d));
      if (target && Math.abs(d) < TANK.aimTolerance && e.fireCd === 0 && e.cashoutTicks === 0 && !isProtected(sim, e)) {
        e.fireCd = TANK.fireCooldown;
        e.firing = 4;
        const mx = e.x + Math.cos(e.turret) * (e.r + 14);
        const my = e.y + Math.sin(e.turret) * (e.r + 14);
        state.shells.push({ id: sim.newId(), x: mx, y: my, vx: Math.cos(e.turret) * TANK.shellSpeed, vy: Math.sin(e.turret) * TANK.shellSpeed, owner: e.id, life: TANK.shellLife });
        sim.emit({ t: 'fx', kind: 'shot', x: mx, y: my, id: e.id });
      }
    }

    // shells
    const keep: typeof state.shells = [];
    for (const s of state.shells) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life--;
      let hit = s.life <= 0 || s.x < 0 || s.y < 0 || s.x > W || s.y > H;
      if (!hit) for (const c of state.crates) if (Math.hypot(c.x - s.x, c.y - s.y) < c.r) { hit = true; sim.emit({ t: 'fx', kind: 'ricochet', x: s.x, y: s.y }); break; }
      if (!hit) {
        for (const e of alive) {
          if (!e.alive || e.id === s.owner) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 4) {
            const owner = sim.entities.get(s.owner) ?? null;
            const sp = Math.hypot(s.vx, s.vy) || 1;
            sim.emit({ t: 'fx', kind: 'hit', x: s.x, y: s.y, id: s.owner });
            tankDamage(sim, e, TANK.shellDamage, owner && owner.alive ? owner : null, s.vx / sp, s.vy / sp, TANK.shellKnock);
            hit = true;
            break;
          }
        }
      }
      if (!hit) keep.push(s);
    }
    state.shells = keep;

    // mines
    for (const m of state.mines) {
      if (m.respawnAt > tick) continue;
      if (m.respawnAt !== 0 && m.respawnAt === tick) {
        Object.assign(m, freeSpot(sim, state.crates));
        m.armedAt = tick + TANK.mineArm;
        m.respawnAt = 0;
      }
      if (tick < m.armedAt) continue;
      if (!alive.some((e) => e.alive && Math.hypot(e.x - m.x, e.y - m.y) < TANK.mineTrigger + e.r && !isProtected(sim, e))) continue;
      sim.emit({ t: 'fx', kind: 'mine', x: m.x, y: m.y });
      for (const e of alive) {
        const dx = e.x - m.x;
        const dy = e.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < TANK.mineBlast + e.r) {
          const by = e.lastHit && tick - e.lastHit.tick <= TANK.creditWindow ? sim.entities.get(e.lastHit.by) ?? null : null;
          tankDamage(sim, e, TANK.mineDamage * (1 - (d / (TANK.mineBlast + e.r)) * 0.4), by, dx / d, dy / d, TANK.mineKnock);
        }
      }
      m.respawnAt = tick + TANK.mineRespawn;
    }

    // repair kits and regen
    if (tick >= state.nextKit) {
      state.nextKit = tick + TANK.kitEvery;
      if (state.kits.length < TANK.kitMax) state.kits.push({ id: sim.newId(), ...freeSpot(sim, state.crates) });
    }
    for (const e of alive) {
      if (!e.alive) continue;
      for (let i = state.kits.length - 1; i >= 0; i--) {
        const k = state.kits[i]!;
        if (e.hp < TANK.maxHp && Math.hypot(k.x - e.x, k.y - e.y) < e.r + 16) {
          e.hp = Math.min(TANK.maxHp, e.hp + TANK.kitHeal);
          state.kits.splice(i, 1);
          sim.emit({ t: 'fx', kind: 'orb', x: k.x, y: k.y, id: e.id });
        }
      }
      if (tick - e.lastDamagedTick > TANK.regenDelay) e.hp = Math.min(TANK.maxHp, e.hp + TANK.regenPerSecond * dt);
    }
  },

  createBrain: createTankBrain,
  botInput: tankBotInput,

  snapshot(sim, _viewer, cx, cy) {
    const R = TANK_CONFIG.viewRadius;
    const near = (x: number, y: number) => Math.abs(x - cx) < R && Math.abs(y - cy) < R;
    const out: EntitySnap[] = [];
    const r1 = (v: number) => Math.round(v * 10) / 10;
    for (const e of sim.entities.values()) {
      if (!e.alive || !near(e.x, e.y)) continue;
      let f = 0;
      if (tankShielded(e)) f |= EntFlag.Shield;
      if (dashing(e)) f |= EntFlag.Dash;
      if (e.firing > 0) f |= EntFlag.Attack;
      // `p` is used by the room for cash-out; the turret angle rides in `pts`
      out.push({ id: e.id, k: TankKind.Tank, x: r1(e.x), y: r1(e.y), r: e.r, a: Math.round(e.angle * 100) / 100, c: e.color, f, h: Math.round((e.hp / TANK.maxHp) * 100) / 100, pts: [Math.round(e.turret * 100) / 100] });
    }
    for (const s of sim.state.shells) if (near(s.x, s.y)) out.push({ id: s.id, k: TankKind.Shell, x: r1(s.x), y: r1(s.y), r: 6, a: Math.round(Math.atan2(s.vy, s.vx) * 100) / 100 });
    for (const c of sim.state.crates) if (near(c.x, c.y)) out.push({ id: c.id, k: TankKind.Crate, x: Math.round(c.x), y: Math.round(c.y), r: Math.round(c.r) });
    for (const m of sim.state.mines) if (m.respawnAt === 0 && near(m.x, m.y)) out.push({ id: m.id, k: TankKind.Mine, x: Math.round(m.x), y: Math.round(m.y), r: TANK.mineRadius, p: sim.tick >= m.armedAt ? 1 : 0 });
    for (const k of sim.state.kits) if (near(k.x, k.y)) out.push({ id: k.id, k: TankKind.Kit, x: Math.round(k.x), y: Math.round(k.y), r: 16 });
    return out;
  },
};
