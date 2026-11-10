import type { Room } from '@arena/engine';
import type { PlayerInput } from '@arena/shared';
import { HERO, type Script, ScriptedSession } from './scripted-session';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ent = any;

const s = (sec: number) => Math.round(sec * 30);

function hero(room: Room): Ent | null {
  for (const e of room.entities.values()) if ((e as Ent).ownerId === HERO && e.alive) return e;
  return null;
}
function bots(room: Room): Ent[] {
  return [...room.entities.values()].filter((e: Ent) => e.alive && e.isBot);
}
function nearestBot(room: Room, h: Ent): Ent | null {
  let best: Ent | null = null;
  let bd = Infinity;
  for (const b of bots(room)) {
    const d = Math.hypot(b.x - h.x, b.y - h.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
const steer = (h: Ent, x: number, y: number): Partial<PlayerInput> => {
  const d = Math.hypot(x - h.x, y - h.y) || 1;
  return { dx: (x - h.x) / d, dy: (y - h.y) / d };
};

/**
 * VOLT HERO RUN (~17.5 s): spawn and roam, lightning lands close by, two KOs
 * (each pays +0.80: stake 1.00 -> 1.80 -> 2.60), then a cash-out held for
 * 3 s while an opponent attacks; the hero survives and banks the stake.
 */
export function voltHero(): ScriptedSession {
  let victim: Ent | null = null;
  let attacker: Ent | null = null;
  let pin: { x: number; y: number } | null = null;
  const script: Script = (room, t) => {
    const h = hero(room);
    if (!h) return null;
    const st = room.state as Ent;
    // keep the hero standing for the shoot (bots still fight each other for real)
    if (t < s(11)) h.hp = Math.max(h.hp, 55);
    // keep other bots out of the hero's moments
    for (const b of bots(room)) {
      if (b === victim || b === attacker) continue;
      const d = Math.hypot(b.x - h.x, b.y - h.y);
      if (d < 260) {
        b.x += ((b.x - h.x) / d) * 6;
        b.y += ((b.y - h.y) / d) * 6;
      }
    }
    if (t === s(2.4)) st.strikes.push({ id: room.newId(), x: h.x + 190, y: h.y - 120, r: 110, fireTick: room.tick + 40 });

    // KO #1 at ~6.2 s, KO #2 at ~9.2 s
    for (const at of [s(5.7), s(8.7)]) {
      if (t === at) {
        victim = nearestBot(room, h);
        if (victim) {
          victim.hp = 22;
          victim.protectedUntil = 0;
          victim.effects = [0, 0];
          const a = h.angle;
          victim.x = h.x + Math.cos(a) * 230;
          victim.y = h.y + Math.sin(a) * 230;
          victim.kvx = victim.kvy = 0;
          pin = { x: victim.x, y: victim.y };
        }
      }
      if (victim && t > at && t < at + s(1.6)) {
        if (!victim.alive) {
          victim = null;
          continue;
        }
        // bots pick their own inputs every tick, so hold this one's skills on cooldown instead
        victim.cooldowns = [999, 999];
        victim.effects = [0, 0];
        // stunned in place for the shot (a hurt bot would otherwise run)
        if (pin && Math.hypot(victim.kvx, victim.kvy) < 50) {
          victim.x = pin.x;
          victim.y = pin.y;
        }
        const inp = steer(h, victim.x, victim.y);
        const d = Math.hypot(victim.x - h.x, victim.y - h.y);
        return { ...inp, skill1: d < 170 && h.cooldowns[0] === 0 };
      }
    }

    // cash-out at 11.5 s; an attacker rushes in at 12.2 s and lands jabs
    if (t >= s(11.5)) {
      if (t === s(12.0)) {
        attacker = nearestBot(room, h);
        if (attacker) {
          attacker.protectedUntil = 0;
          attacker.x = h.x - 260;
          attacker.y = h.y + 40;
          attacker.hp = 100;
        }
      }
      if (attacker && attacker.alive) {
        // walk the attacker in; its jabs land on their own once in reach
        const d = Math.hypot(h.x - attacker.x, h.y - attacker.y) || 1;
        attacker.cooldowns = [999, 999];
        if (d > 64) {
          attacker.x += ((h.x - attacker.x) / d) * 7;
          attacker.y += ((h.y - attacker.y) / d) * 7;
        }
      }
      h.hp = Math.max(h.hp, 18); // narrowly survives
      return { dx: 0.35, dy: -0.2, cashout: true };
    }
    // roam toward the centre
    const w = room.config.width / 2;
    return { ...steer(h, w + Math.sin(t / 40) * 300, w + Math.cos(t / 55) * 200) };
  };
  return new ScriptedSession('volt', 'NeonAce', 4242, script, 10);
}

/** BLOB RUN (~7 s): graze pellets, then swallow a smaller cell for +0.80. */
export function blobHero(): ScriptedSession {
  let prey: Ent | null = null;
  let preyPin: { x: number; y: number } | null = null;
  const script: Script = (room, t) => {
    const h = hero(room);
    if (!h) return null;
    if (t === 1) {
      h.mass = 70;
      h.r = 6 * Math.sqrt(70);
    }
    if (t === s(2.4)) {
      prey = nearestBot(room, h);
      if (prey) {
        prey.mass = 22;
        prey.r = 6 * Math.sqrt(22);
        prey.protectedUntil = 0;
        prey.effects = [0, 0];
        prey.x = h.x + 260;
        prey.y = h.y - 30;
        preyPin = { x: prey.x, y: prey.y };
        h.protectedUntil = 0; // spawn protection would stop the hero from eating
      }
    }
    if (prey && prey.alive && t > s(2.4)) {
      // the prey's AI would flee; hold it for the shot
      prey.cooldowns = [999, 999];
      prey.effects = [0, 0];
      if (preyPin) {
        preyPin.x += 0.8;
        prey.x = preyPin.x;
        prey.y = preyPin.y;
      }
      return steer(h, prey.x, prey.y);
    }
    return { dx: Math.cos(t / 50), dy: Math.sin(t / 70) * 0.6 };
  };
  return new ScriptedSession('blob', 'NeonAce', 777, script, 10);
}

export const SCENARIOS: Record<string, () => ScriptedSession> = { volt: voltHero, blob: blobHero };
