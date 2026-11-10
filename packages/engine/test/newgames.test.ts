import { describe, expect, it } from 'vitest';
import { Rng } from '@arena/shared';
import { HOUSE, MINT, MemoryLedger, Room, SUMO, SUMO_CX, SUMO_CY, coilGame, platformAt, sumoGame, walletAcc, type Snake, type Wrestler } from '../src';
import { assertLedgerInvariants } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */
function duel<E>(game: any, seed = 1) {
  const ledger = new MemoryLedger();
  const room = new Room(game, { seed, ledger, targetPopulation: 0 });
  for (const p of ['a', 'b']) {
    room.addPlayer(p, p);
    ledger.transfer(MINT, walletAcc(p), 500, 'grant');
    room.spawn(p);
  }
  const [a, b] = [...room.entities.values()] as unknown as E[];
  (a as any).protectedUntil = (b as any).protectedUntil = 0;
  return { room, ledger, a: a!, b: b! };
}

function fuzz(game: any, seed: number) {
  const ledger = new MemoryLedger();
  const room = new Room(game, { seed, ledger, targetPopulation: 20 });
  const rng = new Rng(seed + 1);
  let kills = 0;
  let byPlayer = 0;
  let cashouts = 0;
  for (let t = 0; t < 12000; t++) {
    for (const p of ['p0', 'p1', 'p2']) {
      if (!room.snapshotFor(p)) {
        if (rng.chance(0.02) && room.hasSpaceForHuman()) {
          room.addPlayer(p, p);
          ledger.transfer(MINT, walletAcc(p), 500, 'grant');
        }
        continue;
      }
      if (room.snapshotFor(p)!.you.state !== 'alive' && rng.chance(0.05)) room.spawn(p);
      if (rng.chance(0.002)) room.removePlayer(p);
      else room.setInput(p, { dx: rng.range(-1, 1), dy: rng.range(-1, 1), skill1: rng.chance(0.05), skill2: rng.chance(0.02), cashout: rng.chance(0.1) });
    }
    room.step();
    for (const ev of room.lastEvents) {
      if (ev.t === 'kill') {
        kills++;
        if (ev.killerId !== null) byPlayer++;
      }
      if (ev.t === 'cashout') cashouts++;
    }
    if (t % 500 === 0) assertLedgerInvariants(ledger, room);
  }
  assertLedgerInvariants(ledger, room);
  return { kills, byPlayer, cashouts };
}

describe('Coil Stake', () => {
  it('a head hitting a body pays the body owner 80%', () => {
    const { room, ledger, a, b } = duel<Snake>(coilGame, 3);
    const house0 = ledger.balance(HOUSE);
    // put a's head on the middle of b's body
    const mid = Math.floor(b.body.length / 4) * 2;
    a.x = b.body[mid]!;
    a.y = b.body[mid + 1]! ;
    a.body[0] = a.x;
    a.body[1] = a.y;
    room.setInput('a', { dx: Math.cos(a.angle), dy: Math.sin(a.angle) });
    room.step();
    expect(a.alive).toBe(false);
    expect(room.stakeOf(b)).toBe(180);
    expect(ledger.balance(HOUSE) - house0).toBe(20);
  });

  it('jumping snakes pass over bodies', () => {
    const { room, a, b } = duel<Snake>(coilGame, 4);
    room.setInput('a', { skill1: true, dx: Math.cos(a.angle), dy: Math.sin(a.angle) });
    room.step();
    const mid = Math.floor(b.body.length / 4) * 2;
    a.x = b.body[mid]!;
    a.y = b.body[mid + 1]!;
    room.step();
    expect(a.alive).toBe(true);
  });

  it('walls kill and the stake goes to the house; the body drops food', () => {
    const { room, ledger, a } = duel<Snake>(coilGame, 5);
    const house0 = ledger.balance(HOUSE);
    const pellets0 = (room.state as any).pellets.size;
    a.x = 2;
    a.y = 1000;
    room.step();
    expect(a.alive).toBe(false);
    expect(ledger.balance(HOUSE) - house0).toBe(100);
    expect((room.state as any).pellets.size).toBeGreaterThan(pellets0);
  });

  it('eating pellets grows the snake', () => {
    const { room, a } = duel<Snake>(coilGame, 6);
    const m0 = a.mass;
    const st = room.state as any;
    for (let i = 0; i < 5; i++) {
      const p = { id: room.newId(), x: a.x + Math.cos(a.angle) * 6, y: a.y + Math.sin(a.angle) * 6, mass: 1, hue: 0, golden: false };
      st.pellets.set(p.id, p);
      st.grid.insert(p);
    }
    room.setInput('a', { dx: Math.cos(a.angle), dy: Math.sin(a.angle) });
    room.step();
    expect(a.mass).toBeGreaterThan(m0);
  });

  it('conserves credits over a long chaotic session', () => {
    const r = fuzz(coilGame, 21);
    expect(r.kills).toBeGreaterThan(20);
    expect(r.byPlayer).toBeGreaterThan(5);
  }, 60_000);
});

describe('Sumo Smash', () => {
  it('the platform shrinks, holds, then snaps back', () => {
    expect(platformAt(0).r).toBe(SUMO.maxRadius);
    expect(platformAt(SUMO.shrinkTime + 1).r).toBe(SUMO.minRadius);
    expect(platformAt(SUMO.shrinkTime + SUMO.holdTime + SUMO.snapTime - 1).r).toBeGreaterThan(SUMO.maxRadius * 0.95);
  });

  it('the last toucher gets the kill when you fall off', () => {
    const { room, ledger, a, b } = duel<Wrestler>(sumoGame, 7);
    const house0 = ledger.balance(HOUSE);
    a.x = SUMO_CX;
    a.y = SUMO_CY + 300;
    b.x = SUMO_CX;
    b.y = SUMO_CY + 300 + a.r + b.r - 4;
    a.vy = 600; // a slams into b
    room.step();
    expect(b.lastHit?.by).toBe(a.id);
    b.x = SUMO_CX;
    b.y = SUMO_CY + 1200; // off the mat
    for (let i = 0; i < 20; i++) room.step();
    expect(b.alive).toBe(false);
    expect(room.stakeOf(a)).toBe(180);
    expect(ledger.balance(HOUSE) - house0).toBe(20);
  });

  it('falling with no recent touch pays the house', () => {
    const { room, ledger, b } = duel<Wrestler>(sumoGame, 8);
    const house0 = ledger.balance(HOUSE);
    b.x = SUMO_CX + 1300;
    for (let i = 0; i < 20; i++) room.step();
    expect(b.alive).toBe(false);
    expect(ledger.balance(HOUSE) - house0).toBe(100);
  });

  it('Heavy makes you hard to move', () => {
    const { room, a, b } = duel<Wrestler>(sumoGame, 9);
    room.setInput('b', { skill2: true });
    room.step();
    a.x = SUMO_CX;
    a.y = SUMO_CY + 300;
    b.x = SUMO_CX;
    b.y = SUMO_CY + 300 + a.r + b.r - 4;
    a.vy = 600;
    b.vx = b.vy = 0;
    room.step();
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(400);
  });

  it('conserves credits over a long chaotic session', () => {
    const r = fuzz(sumoGame, 31);
    expect(r.kills).toBeGreaterThan(20);
    expect(r.byPlayer).toBeGreaterThan(5);
  }, 60_000);
});
