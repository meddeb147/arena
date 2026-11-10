import { EntFlag, type EntitySnap } from '@arena/shared';
import { isProtected, type BaseEntity, type GameModule, type Sim } from '../../types';
import { LEVEL, STOMP, STOMP_CONFIG, StompKind } from './config';
import { createStompBrain, stompBotInput } from './bot';
import type { Mover, StompBrain, StompState, Stomper } from './types';

export type StompSim = Sim<Stomper, StompState>;
const POUND = 1;

/** All solid tops this tick: static platforms and movers. [x, y, w, moverIndex] */
export function surfaces(state: StompState): [number, number, number, number][] {
  const out: [number, number, number, number][] = LEVEL.platforms.map(([x, y, w]) => [x, y, w, -1]);
  state.movers.forEach((m, i) => out.push([m.x, m.y, m.w, i]));
  return out;
}

function jump(sim: StompSim, e: Stomper): boolean {
  if (e.grounded || e.airTicks <= STOMP.coyote) {
    e.vy = -STOMP.jumpSpeed;
    e.grounded = false;
    e.airTicks = STOMP.coyote + 1;
    e.canDouble = true;
    e.jumpHeld = true;
    return true;
  }
  if (e.canDouble && !e.pounding) {
    e.vy = -STOMP.doubleJumpSpeed;
    e.canDouble = false;
    e.jumpHeld = true;
    sim.emit({ t: 'fx', kind: 'double', x: e.x, y: e.y + STOMP.hh, id: e.id });
    return true;
  }
  return false;
}

function killBy(sim: StompSim, victim: Stomper, cause: 'hazard'): void {
  const by = victim.lastHit && sim.tick - victim.lastHit.tick <= STOMP.creditWindow ? sim.entities.get(victim.lastHit.by) : undefined;
  const killer = by && by.alive && by !== victim ? by : null;
  sim.kill(victim, killer, killer ? 'player' : cause);
}

export const stompGame: GameModule<Stomper, StompState, StompBrain> = {
  config: STOMP_CONFIG,

  createState(init) {
    return {
      movers: LEVEL.movers.map(([x, y, w, travel, speed], i) => ({ id: init.newId(), x0: x, y, w, travel, speed, x, dx: 0, phase: i })) as Mover[],
      ids: {
        platforms: LEVEL.platforms.map(() => init.newId()),
        springs: LEVEL.springs.map(() => init.newId()),
        spikes: LEVEL.spikes.map(() => init.newId()),
      },
    };
  },

  createEntity(base: BaseEntity, sim) {
    // spawn on a platform away from others, never on spikes
    let best = { x: 400, y: 1700 - STOMP.hh };
    let bestScore = -Infinity;
    for (let i = 0; i < 14; i++) {
      const [px, py, pw] = sim.rng.pick(LEVEL.platforms);
      const x = px + sim.rng.range(30, pw - 30);
      if (LEVEL.spikes.some(([sx, sy, sw]) => sy === py && x > sx - 40 && x < sx + sw + 40)) continue;
      const p = { x, y: py - STOMP.hh };
      let score = Infinity;
      for (const o of sim.entities.values()) if (o.alive) score = Math.min(score, Math.hypot(o.x - p.x, o.y - p.y));
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return { ...base, ...best, r: STOMP.hw, grounded: true, airTicks: 0, canDouble: true, jumpHeld: false, upWasDown: false, pounding: false, facing: 1, onMover: -1, bumpVx: 0, prevBottom: best.y + STOMP.hh };
  },

  useSkill(sim, e, slot) {
    if (slot === 0) return jump(sim, e);
    if (e.grounded) return false; // ground pound only in the air
    e.pounding = true;
    e.vy = STOMP.poundSpeed;
    e.bumpVx = 0;
    return true;
  },

  step(sim) {
    const { state, dt, tick } = sim;
    const t = tick * dt;
    for (const m of state.movers) {
      const nx = m.x0 + Math.sin(t * m.speed + (m as Mover & { phase: number }).phase) * m.travel * 0.5 + m.travel * 0.5;
      m.dx = nx - m.x;
      m.x = nx;
    }
    const tops = surfaces(state);
    const alive: Stomper[] = [];
    for (const e of sim.entities.values()) if (e.alive) alive.push(e);

    for (const e of alive) {
      // jump on "up" too (keyboard W/arrow, joystick flick), edge-triggered
      const up = e.input.dy < -0.6;
      if (up && !e.upWasDown && e.cashoutTicks === 0) jump(sim, e);
      e.upWasDown = up;
      if (!up && !e.input.skill1 && e.jumpHeld && e.vy < 0) {
        e.vy *= STOMP.jumpCut; // short hop when the button is released early
        e.jumpHeld = false;
      }
      if (e.vy >= 0) e.jumpHeld = false;

      // horizontal
      const max = STOMP.runSpeed * (e.cashoutTicks > 0 ? STOMP.cashoutSpeedMul : 1);
      const want = Math.abs(e.input.dx) > 0.15 ? Math.sign(e.input.dx) * max * Math.min(1, Math.abs(e.input.dx) * 1.4) : 0;
      if (want !== 0) e.facing = want > 0 ? 1 : -1;
      const accel = e.grounded ? STOMP.accelGround : STOMP.accelAir;
      if (e.pounding) e.vx *= 0.8;
      else if (want !== 0) e.vx += Math.max(-accel * dt, Math.min(accel * dt, want - e.vx));
      else if (e.grounded) e.vx -= Math.sign(e.vx) * Math.min(Math.abs(e.vx), STOMP.friction * dt);
      e.bumpVx *= Math.exp(-6 * dt);

      // gravity
      if (!e.pounding) e.vy = Math.min(STOMP.maxFall, e.vy + STOMP.gravity * dt);
      const prevBottom = e.y + STOMP.hh;
      e.prevBottom = prevBottom;
      e.x += (e.vx + e.bumpVx) * dt;
      e.y += e.vy * dt;
      if (e.onMover >= 0 && e.grounded) e.x += state.movers[e.onMover]!.dx;
      e.x = Math.max(STOMP.hw, Math.min(STOMP_CONFIG.width - STOMP.hw, e.x));
      e.y = Math.max(STOMP.hh, e.y);

      // land on one-way tops (only when falling through from above)
      const wasGrounded = e.grounded;
      e.grounded = false;
      e.onMover = -1;
      if (e.vy >= 0) {
        const bottom = e.y + STOMP.hh;
        for (const [px, py, pw, mi] of tops) {
          if (e.x + STOMP.hw * 0.6 < px || e.x - STOMP.hw * 0.6 > px + pw) continue;
          if (prevBottom <= py + 2 && bottom >= py) {
            e.y = py - STOMP.hh;
            if (e.pounding) {
              sim.emit({ t: 'fx', kind: 'pound', x: e.x, y: py, id: e.id });
              e.pounding = false;
            } else if (!wasGrounded && e.vy > 700) sim.emit({ t: 'fx', kind: 'land', x: e.x, y: py });
            e.vy = 0;
            e.grounded = true;
            e.canDouble = true;
            e.onMover = mi;
            break;
          }
        }
      }
      e.airTicks = e.grounded ? 0 : e.airTicks + 1;
      e.angle = e.facing === 1 ? 0 : Math.PI;
    }

    // springs launch, spikes and lava kill
    for (const e of alive) {
      if (!e.alive) continue;
      const feet = e.y + STOMP.hh;
      for (const [sx, sy] of LEVEL.springs) {
        if (Math.abs(e.x - sx) < 34 && Math.abs(feet - sy) < 6 && e.grounded) {
          e.vy = -STOMP.springSpeed;
          e.grounded = false;
          e.canDouble = true;
          e.pounding = false;
          sim.emit({ t: 'fx', kind: 'spring', x: sx, y: sy, id: e.id });
        }
      }
      if (isProtected(sim, e)) continue;
      for (const [sx, sy, sw] of LEVEL.spikes) {
        if (e.x > sx + 4 && e.x < sx + sw - 4 && Math.abs(feet - sy) < 3) {
          sim.emit({ t: 'fx', kind: 'spiked', x: e.x, y: e.y });
          killBy(sim, e, 'hazard');
          break;
        }
      }
      if (e.alive && e.y + STOMP.hh * 0.5 > STOMP.lavaY) {
        sim.emit({ t: 'fx', kind: 'lava', x: e.x, y: STOMP.lavaY });
        killBy(sim, e, 'hazard');
      }
    }

    // stomps and bumps
    for (const a of alive) {
      if (!a.alive) continue;
      for (const b of alive) {
        if (a === b || !b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) > STOMP.hw * 2 || Math.abs(dy) > STOMP.hh * 2) continue;
        // a lands on b's head
        const aBottom = a.y + STOMP.hh;
        const bTop = b.y - STOMP.hh;
        const reach = a.pounding ? STOMP.hw * 2.2 : STOMP.hw * 1.6;
        const crossed = a.prevBottom <= bTop + 8 && aBottom >= bTop - 2;
        if ((a.vy > STOMP.stompMinVy || a.pounding) && crossed && Math.abs(dx) < reach && !isProtected(sim, a)) {
          // jumping up into someone is a head-bonk: both bounce, nobody dies
          if (isProtected(sim, b) || (b.vy < -200 && !a.pounding)) {
            a.vy = -STOMP.stompBounce * 0.7;
            b.vy = Math.max(b.vy, 200);
            sim.emit({ t: 'fx', kind: 'bonk', x: b.x, y: bTop, id: a.id });
            continue;
          }
          sim.emit({ t: 'fx', kind: 'stomp', x: b.x, y: bTop, id: a.id });
          sim.kill(b, a, 'player');
          a.vy = -STOMP.stompBounce;
          a.canDouble = true;
          a.pounding = false;
          continue;
        }
        // side bump: shove apart, remember who touched whom (lava credit)
        if (Math.abs(dy) < STOMP.hh * 1.4 && Math.abs(dx) < STOMP.hw * 2 && a.id < b.id) {
          const dir = dx === 0 ? 1 : Math.sign(dx);
          const overlap = STOMP.hw * 2 - Math.abs(dx);
          a.x -= dir * overlap * 0.5;
          b.x += dir * overlap * 0.5;
          // only a real collision (moving into each other) shoves; resting contact just separates
          const rel = (a.vx + a.bumpVx - b.vx - b.bumpVx) * dir;
          if (rel > 120) {
            const push = STOMP.bumpPush + rel * 0.4;
            a.bumpVx -= dir * push * 0.5;
            b.bumpVx += dir * push * 0.5;
            a.lastHit = { by: b.id, tick };
            b.lastHit = { by: a.id, tick };
            if (rel > 260) sim.emit({ t: 'fx', kind: 'bump', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          }
        }
      }
    }
  },

  createBrain: createStompBrain,
  botInput: stompBotInput,

  snapshot(sim, _viewer, cx, cy) {
    const R = STOMP_CONFIG.viewRadius;
    const out: EntitySnap[] = [];
    const near = (x: number, y: number, pad = 0) => Math.abs(x - cx) < R + pad && Math.abs(y - cy) < R + pad;
    for (const e of sim.entities.values()) {
      if (!e.alive || !near(e.x, e.y)) continue;
      let f = 0;
      if (!e.grounded) f |= EntFlag.Jump;
      if (e.pounding) f |= EntFlag.Attack;
      // `a` = facing, `h` = vertical speed (for squash and stretch)
      out.push({ id: e.id, k: StompKind.Player, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, r: STOMP.hw, a: e.angle, c: e.color, f, h: Math.round((e.vy / STOMP.maxFall) * 100) / 100 });
    }
    LEVEL.platforms.forEach(([x, y, w, hgt], i) => {
      if (near(x + w / 2, y, w)) out.push({ id: sim.state.ids.platforms[i]!, k: StompKind.Platform, x, y, r: w / 2, pts: [w, hgt] });
    });
    for (const m of sim.state.movers) if (near(m.x, m.y, m.w)) out.push({ id: m.id, k: StompKind.Mover, x: Math.round(m.x * 10) / 10, y: m.y, r: m.w / 2, pts: [m.w, 24] });
    LEVEL.springs.forEach(([x, y], i) => {
      if (near(x, y)) out.push({ id: sim.state.ids.springs[i]!, k: StompKind.Spring, x, y, r: 30 });
    });
    LEVEL.spikes.forEach(([x, y, w], i) => {
      if (near(x, y, w)) out.push({ id: sim.state.ids.spikes[i]!, k: StompKind.Spikes, x, y, r: w / 2, pts: [w] });
    });
    return out;
  },
};
