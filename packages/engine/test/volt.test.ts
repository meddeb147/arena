import { describe, expect, it } from 'vitest';
import { Rng } from '@arena/shared';
import { HOUSE, MINT, MemoryLedger, Room, VOLT, voltGame, walletAcc, type VoltFighter } from '../src';
import { voltDamage } from '../src/games/volt';
import { assertLedgerInvariants } from './helpers';

function duel(seed = 1) {
  const ledger = new MemoryLedger();
  const room = new Room(voltGame, { seed, ledger, targetPopulation: 0 });
  for (const p of ['a', 'b']) {
    room.addPlayer(p, p);
    ledger.transfer(MINT, walletAcc(p), 500, 'grant');
    room.spawn(p);
  }
  const [a, b] = [...room.entities.values()] as VoltFighter[];
  a!.protectedUntil = b!.protectedUntil = 0;
  return { room, ledger, a: a!, b: b! };
}

describe('Volt Brawl', () => {
  it('jabs automatically when an enemy is in reach', () => {
    const { room, a, b } = duel();
    b.x = a.x + a.r + b.r + 10;
    b.y = a.y;
    room.step();
    expect(b.hp).toBeLessThan(VOLT.maxHp);
    expect(b.lastHit?.by).toBe(a.id);
  });

  it('a dash hit does heavy damage once per dash', () => {
    const { room, a, b } = duel(2);
    a.x = 1200;
    a.y = 1400;
    b.x = 1200 + 120;
    b.y = 1400;
    room.setInput('a', { dx: 1, dy: 0, skill1: true });
    for (let i = 0; i < 8; i++) room.step();
    expect(VOLT.maxHp - b.hp).toBeGreaterThanOrEqual(VOLT.dashDamage);
  });

  it('the last hitter gets 80% when a hazard finishes the victim', () => {
    const { room, ledger, a, b } = duel(3);
    const house0 = ledger.balance(HOUSE);
    voltDamage(room, b, 10, a, 1, 0, 0); // a tags b
    b.hp = 1;
    voltDamage(room, b, 50, null, 1, 0, 0); // lightning / pylon
    expect(b.alive).toBe(false);
    expect(room.stakeOf(a)).toBe(180);
    expect(ledger.balance(HOUSE) - house0).toBe(20);
    room.step();
    assertLedgerInvariants(ledger, room);
  });

  it('an unassisted hazard death sends the whole stake to the house', () => {
    const { room, ledger, b } = duel(4);
    const house0 = ledger.balance(HOUSE);
    voltDamage(room, b, 500, null, 1, 0, 0);
    expect(b.alive).toBe(false);
    expect(ledger.balance(HOUSE) - house0).toBe(100);
  });

  it('old hits expire: no credit after the window', () => {
    const { room, ledger, a, b } = duel(5);
    voltDamage(room, b, 10, a, 1, 0, 0);
    for (let i = 0; i < VOLT.creditWindow + 2; i++) room.step();
    const house0 = ledger.balance(HOUSE);
    voltDamage(room, b, 500, null, 1, 0, 0);
    expect(room.stakeOf(a)).toBe(100);
    expect(ledger.balance(HOUSE) - house0).toBe(100);
  });

  it('shield and spawn protection block damage', () => {
    const { room, a, b } = duel(6);
    room.setInput('b', { skill2: true });
    room.step();
    voltDamage(room, b, 50, a, 1, 0, 0);
    expect(b.hp).toBeGreaterThan(VOLT.maxHp - 1);
    a.protectedUntil = room.tick + 100;
    voltDamage(room, a, 50, b, 1, 0, 0);
    expect(a.hp).toBe(VOLT.maxHp);
  });

  it('fighters never leave the cage', () => {
    const ledger = new MemoryLedger();
    const room = new Room(voltGame, { seed: 9, ledger, targetPopulation: 20 });
    for (let i = 0; i < 3000; i++) {
      room.step();
      for (const e of room.entities.values()) {
        const d = Math.hypot(e.x - 1400, e.y - 1400);
        expect(d).toBeLessThan(VOLT.arenaRadius);
      }
    }
  });

  it('conserves credits over a long chaotic session', () => {
    const ledger = new MemoryLedger();
    const room = new Room(voltGame, { seed: 77, ledger, targetPopulation: 20 });
    const rng = new Rng(5);
    const players = ['p0', 'p1', 'p2', 'p3'];
    let kills = 0;
    let cashouts = 0;
    let assisted = 0;
    for (let t = 0; t < 12000; t++) {
      for (const p of players) {
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
          if (ev.killerId !== null) assisted++;
        }
        if (ev.t === 'cashout') cashouts++;
      }
      if (t % 500 === 0) assertLedgerInvariants(ledger, room);
    }
    assertLedgerInvariants(ledger, room);
    expect(kills).toBeGreaterThan(20);
    expect(assisted).toBeGreaterThan(5);
    expect(cashouts).toBeGreaterThan(0);
  }, 60_000);
});
