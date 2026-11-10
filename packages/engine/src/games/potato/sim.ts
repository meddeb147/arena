import { EntFlag, type EntitySnap } from '@arena/shared';
import { isProtected, type BaseEntity, type GameModule, type Sim } from '../../types';
import { POTATO, POTATO_CONFIG, PotatoKind } from './config';
import { createPotatoBrain, potatoBotInput } from './bot';
import type { Potato, PotatoBrain, PotatoState, Runner } from './types';

export type PotatoSim = Sim<Runner, PotatoState>;
const DASH = 0;
const SHIELD = 1;
export const potatoShielded = (e: Runner) => e.effects[SHIELD] > 0;
const dashing = (e: Runner) => e.effects[DASH] > 0;
export const holding = (state: PotatoState, e: Runner) => state.potatoes.some((p) => p.holder === e.id);

export const potatoGame: GameModule<Runner, PotatoState, PotatoBrain> = {
  config: POTATO_CONFIG,

  createState(init) {
    const pillars = [];
    for (let i = 0; i < POTATO.pillarCount; i++) {
      const a = (i / POTATO.pillarCount) * Math.PI * 2;
      const d = i % 2 ? 420 : 760;
      pillars.push({ id: init.newId(), x: POTATO_CONFIG.width / 2 + Math.cos(a) * d, y: POTATO_CONFIG.height / 2 + Math.sin(a) * d, r: init.rng.range(55, 80) });
    }
    return { potatoes: [], pillars };
  },

  createEntity(base: BaseEntity, sim) {
    let best = { x: 300, y: 300 };
    let bestScore = -Infinity;
    for (let i = 0; i < 14; i++) {
      const p = { x: sim.rng.range(150, POTATO_CONFIG.width - 150), y: sim.rng.range(150, POTATO_CONFIG.height - 150) };
      if (sim.state.pillars.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < q.r + 60)) continue;
      let score = Infinity;
      for (const o of sim.entities.values()) if (o.alive) score = Math.min(score, Math.hypot(o.x - p.x, o.y - p.y) * (holding(sim.state, o) ? 0.4 : 1));
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return { ...base, ...best, r: POTATO.radius, kvx: 0, kvy: 0, dashX: 0, dashY: 0 };
  },

  /** no escaping with a potato in your hands */
  canCashout(sim, e) {
    return !holding(sim.state, e);
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
    const W = POTATO_CONFIG.width;
    const H = POTATO_CONFIG.height;
    const alive: Runner[] = [];
    for (const e of sim.entities.values()) if (e.alive) alive.push(e);
    const kd = Math.exp(-5 * dt);

    for (const e of alive) {
      let speed = POTATO.speed * (holding(state, e) ? POTATO.holderSpeedMul : 1) * (e.cashoutTicks > 0 ? POTATO.cashoutSpeedMul : 1);
      if (dashing(e)) {
        speed *= POTATO.dashMul;
        e.vx = e.dashX * speed;
        e.vy = e.dashY * speed;
      } else {
        const k = Math.min(1, POTATO.steerRate * dt);
        e.vx += (e.input.dx * speed - e.vx) * k;
        e.vy += (e.input.dy * speed - e.vy) * k;
      }
      if (Math.hypot(e.vx, e.vy) > 10) e.angle = Math.atan2(e.vy, e.vx);
      e.x = Math.max(e.r, Math.min(W - e.r, e.x + (e.vx + e.kvx) * dt));
      e.y = Math.max(e.r, Math.min(H - e.r, e.y + (e.vy + e.kvy) * dt));
      e.kvx *= kd;
      e.kvy *= kd;
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

    // how many potatoes this room should have
    const want = Math.max(1, Math.min(POTATO.maxPotatoes, Math.floor(alive.length / POTATO.playersPerPotato) + 1));
    while (state.potatoes.length < want) state.potatoes.push({ id: sim.newId(), holder: null, explodeAt: 0, lastPasser: null, immune: null, readyAt: tick + POTATO.respawnDelay, x: W / 2, y: H / 2 });
    if (state.potatoes.length > want) {
      const idle = state.potatoes.findIndex((p) => p.holder === null);
      if (idle >= 0) state.potatoes.splice(idle, 1);
    }

    for (const p of state.potatoes) {
      let holder = p.holder !== null ? sim.entities.get(p.holder) : undefined;
      // holder gone (cashed out impossible, but they may have disconnected): drop it
      if (p.holder !== null && (!holder || !holder.alive)) {
        p.holder = null;
        p.readyAt = tick + POTATO.respawnDelay;
        holder = undefined;
      }
      // hand a fresh potato to someone
      if (p.holder === null && tick >= p.readyAt) {
        const candidates = alive.filter((e) => e.alive && !isProtected(sim, e) && !holding(state, e) && e.cashoutTicks === 0);
        if (candidates.length >= 2) {
          const pick = sim.rng.pick(candidates);
          p.holder = pick.id;
          p.explodeAt = tick + POTATO.fuse;
          p.lastPasser = null;
          p.immune = null;
          sim.emit({ t: 'fx', kind: 'assign', x: pick.x, y: pick.y, id: pick.id });
        }
        continue;
      }
      if (!holder) continue;
      p.x = holder.x;
      p.y = holder.y;
      // pass it by touch
      for (const o of alive) {
        if (o === holder || !o.alive || isProtected(sim, o) || potatoShielded(o) || holding(state, o)) continue;
        if (p.immune && p.immune.id === o.id && tick < p.immune.until) continue;
        if (Math.hypot(o.x - holder.x, o.y - holder.y) > holder.r + o.r + 4) continue;
        p.lastPasser = holder.id;
        p.immune = { id: holder.id, until: tick + POTATO.passImmunity };
        p.holder = o.id;
        sim.emit({ t: 'fx', kind: 'pass', x: (o.x + holder.x) / 2, y: (o.y + holder.y) / 2, id: holder.id });
        holder = o;
        break;
      }
      // boom: the last passer gets the holder's stake
      if (tick >= p.explodeAt) {
        const passer = p.lastPasser !== null ? sim.entities.get(p.lastPasser) : undefined;
        sim.emit({ t: 'fx', kind: 'potato', x: holder.x, y: holder.y });
        for (const o of alive) {
          if (o === holder || !o.alive) continue;
          const dx = o.x - holder.x;
          const dy = o.y - holder.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < POTATO.blastRadius) {
            o.kvx += (dx / d) * POTATO.blastKnock;
            o.kvy += (dy / d) * POTATO.blastKnock;
          }
        }
        sim.kill(holder, passer && passer.alive && passer !== holder ? passer : null, passer ? 'player' : 'hazard');
        p.holder = null;
        p.readyAt = tick + POTATO.respawnDelay;
      }
    }
  },

  onRemove(sim, e) {
    for (const p of sim.state.potatoes) if (p.lastPasser === e.id) p.lastPasser = null;
  },

  createBrain: createPotatoBrain,
  botInput: potatoBotInput,

  snapshot(sim, _viewer, cx, cy) {
    const R = POTATO_CONFIG.viewRadius;
    const near = (x: number, y: number) => Math.abs(x - cx) < R && Math.abs(y - cy) < R;
    const out: EntitySnap[] = [];
    const heldBy = new Map<number, Potato>();
    for (const p of sim.state.potatoes) if (p.holder !== null) heldBy.set(p.holder, p);
    for (const e of sim.entities.values()) {
      if (!e.alive || !near(e.x, e.y)) continue;
      let f = 0;
      if (potatoShielded(e)) f |= EntFlag.Shield;
      if (dashing(e)) f |= EntFlag.Dash;
      const p = heldBy.get(e.id);
      if (p) f |= EntFlag.Attack;
      out.push({ id: e.id, k: PotatoKind.Player, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, r: e.r, a: Math.round(e.angle * 100) / 100, c: e.color, f });
    }
    for (const p of sim.state.potatoes) {
      if (p.holder === null) continue;
      const h = sim.entities.get(p.holder);
      if (!h || !near(h.x, h.y)) continue;
      // `h` = fuse left 0..1 (renderer makes it flash faster near 0)
      out.push({ id: p.id, k: PotatoKind.Potato, x: Math.round(h.x * 10) / 10, y: Math.round(h.y * 10) / 10, r: 18, h: Math.max(0, Math.round(((p.explodeAt - sim.tick) / POTATO.fuse) * 100) / 100) });
    }
    for (const p of sim.state.pillars) if (near(p.x, p.y)) out.push({ id: p.id, k: PotatoKind.Pillar, x: Math.round(p.x), y: Math.round(p.y), r: Math.round(p.r) });
    return out;
  },
};
