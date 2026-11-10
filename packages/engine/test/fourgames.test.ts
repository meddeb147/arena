import { describe, expect, it } from 'vitest';
import { CASHOUT_HOLD_TICKS, Rng } from '@arena/shared';
import { BOMBER, HOUSE, MINT, MemoryLedger, POTATO, Room, bladeGame, blades, bomberGame, potatoGame, tankDamage, tankGame, walletAcc } from '../src';
import { assertLedgerInvariants } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */
function duel(game: any, seed = 1, n = 2) {
  const ledger = new MemoryLedger();
  const room = new Room(game, { seed, ledger, targetPopulation: 0 });
  const names = ['a', 'b', 'c'].slice(0, n);
  for (const p of names) {
    room.addPlayer(p, p);
    ledger.transfer(MINT, walletAcc(p), 500, 'grant');
    room.spawn(p);
  }
  const ents = [...room.entities.values()] as any[];
  for (const e of ents) e.protectedUntil = 0;
  return { room, ledger, ents };
}

function fuzz(game: any, seed: number) {
  const ledger = new MemoryLedger();
  const room = new Room(game, { seed, ledger, targetPopulation: 20 });
  const rng = new Rng(seed + 1);
  let kills = 0;
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
    for (const ev of room.lastEvents) if (ev.t === 'kill') kills++;
    if (t % 500 === 0) assertLedgerInvariants(ledger, room);
  }
  assertLedgerInvariants(ledger, room);
  return kills;
}

describe('Tank Duel', () => {
  it('turrets auto-fire and a shell kill pays the shooter', () => {
    const { room, ledger, ents } = duel(tankGame, 2);
    const [a, b] = ents;
    a.x = 1400; a.y = 1400; b.x = 1700; b.y = 1400;
    (room.state as any).crates = [];
    (room.state as any).mines = [];
    b.hp = 10;
    const house0 = ledger.balance(HOUSE);
    for (let i = 0; i < 90 && b.alive; i++) {
      room.setInput('a', { dx: 0, dy: 0 });
      room.setInput('b', { dx: 0, dy: 0 });
      room.step();
    }
    expect(b.alive).toBe(false);
    expect(room.stakeOf(a)).toBe(180);
    expect(ledger.balance(HOUSE) - house0).toBe(20);
  });
  it('shield blocks damage', () => {
    const { room, ents } = duel(tankGame, 3);
    const [a, b] = ents;
    room.setInput('b', { skill2: true });
    room.step();
    tankDamage(room as any, b, 50, a, 1, 0, 0);
    expect(b.hp).toBe(100);
  });
  it('conserves credits', () => expect(fuzz(tankGame, 41)).toBeGreaterThan(20), 60_000);
});

describe('Blade Spin', () => {
  it('a blade through a body pays the blade owner', () => {
    const { room, ents } = duel(bladeGame, 4);
    const [a, b] = ents;
    (room.state as any).lava = [];
    a.x = 1200; a.y = 1200;
    const tip = blades(a)[0]!;
    b.x = (tip[0] + tip[2]) / 2;
    b.y = (tip[1] + tip[3]) / 2;
    room.step();
    expect(b.alive).toBe(false);
    expect(room.stakeOf(a)).toBe(180);
  });
  it('clashing blades knock both spinners back', () => {
    const { room, ents } = duel(bladeGame, 5);
    const [a, b] = ents;
    (room.state as any).lava = [];
    a.x = 1000; a.y = 1200; a.spinAngle = 0; a.spinDir = 1;
    b.x = 1000 + 2 * (a.r + 4) + 60; b.y = 1200; b.spinAngle = Math.PI; b.spinDir = -1;
    room.step();
    expect(a.kvx).toBeLessThan(0);
    expect(b.kvx).toBeGreaterThan(0);
  });
  it('conserves credits', () => expect(fuzz(bladeGame, 51)).toBeGreaterThan(20), 60_000);
});

describe('Bomber Blast', () => {
  it('a blast kills nearby players and pays the bomb owner; it hits the owner too', () => {
    const { room, ledger, ents } = duel(bomberGame, 6, 3);
    const [a, b, c] = ents;
    (room.state as any).pillars = [];
    a.x = 300; a.y = 300; b.x = 400; b.y = 300; c.x = 1500; c.y = 1500;
    room.setInput('a', { skill1: true });
    room.step();
    room.setInput('a', { skill1: false });
    const house0 = ledger.balance(HOUSE);
    for (let i = 0; i < BOMBER.fuse + 2; i++) room.step();
    expect(b.alive).toBe(false);
    expect(a.alive).toBe(false); // caught in their own blast
    expect(c.alive).toBe(true);
    // b paid the owner (80) before the owner died; owner's whole stake went to the house
    expect(ledger.balance(HOUSE) - house0).toBe(20 + 180);
  });
  it('chain reactions set off nearby bombs', () => {
    const { room, ents } = duel(bomberGame, 7);
    const [a] = ents;
    (room.state as any).pillars = [];
    const st = room.state as any;
    st.bombs.push({ id: 900, x: 1000, y: 1000, vx: 0, vy: 0, owner: null, fuseAt: room.tick + 1, ownerClear: true, bornAt: 0 });
    st.bombs.push({ id: 901, x: 1100, y: 1000, vx: 0, vy: 0, owner: null, fuseAt: room.tick + 500, ownerClear: true, bornAt: 0 });
    a.x = 1800; a.y = 1800;
    for (let i = 0; i < 2; i++) room.step();
    expect(st.bombs.find((b: any) => b.id === 901).fuseAt).toBeLessThan(room.tick + 10);
  });
  it('conserves credits', () => expect(fuzz(bomberGame, 61)).toBeGreaterThan(10), 60_000);
});

describe('Hot Potato', () => {
  it('passes on touch and the last passer gets the stake when it explodes', () => {
    const { room, ledger, ents } = duel(potatoGame, 8);
    const [a, b] = ents;
    (room.state as any).pillars = [];
    a.x = 500; a.y = 500; b.x = 1500; b.y = 1500;
    for (let i = 0; i < POTATO.respawnDelay + 2; i++) room.step();
    const p = (room.state as any).potatoes[0];
    expect(p.holder).not.toBeNull();
    const holder = p.holder === a.id ? a : b;
    const other = holder === a ? b : a;
    other.x = holder.x + holder.r + other.r;
    other.y = holder.y;
    room.step();
    expect(p.holder).toBe(other.id);
    expect(p.lastPasser).toBe(holder.id);
    other.x = 2000; other.y = 2000;
    holder.x = 300; holder.y = 300;
    const house0 = ledger.balance(HOUSE);
    p.explodeAt = room.tick + 1;
    room.step();
    room.step();
    expect(other.alive).toBe(false);
    expect(room.stakeOf(holder)).toBe(180);
    expect(ledger.balance(HOUSE) - house0).toBe(20);
  });
  it('you cannot cash out while holding the potato', () => {
    const { room, ents } = duel(potatoGame, 9);
    const [a, b] = ents;
    a.x = 400; a.y = 400; b.x = 1800; b.y = 1800;
    for (let i = 0; i < POTATO.respawnDelay + 2; i++) room.step();
    const p = (room.state as any).potatoes[0];
    const holderName = p.holder === a.id ? 'a' : 'b';
    const holder = p.holder === a.id ? a : b;
    room.setInput(holderName, { cashout: true });
    for (let i = 0; i < CASHOUT_HOLD_TICKS + 5; i++) room.step();
    expect(holder.cashoutTicks).toBe(0);
  });
  it('conserves credits', () => expect(fuzz(potatoGame, 71)).toBeGreaterThan(10), 60_000);
});
