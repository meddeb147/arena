import { describe, expect, it } from 'vitest';
import { Rng } from '@arena/shared';
import { HOUSE, MINT, MemoryLedger, Room, STOMP, stompGame, walletAcc, type Stomper } from '../src';
import { assertLedgerInvariants } from './helpers';

function duel(seed = 1) {
  const ledger = new MemoryLedger();
  const room = new Room(stompGame, { seed, ledger, targetPopulation: 0 });
  for (const p of ['a', 'b']) {
    room.addPlayer(p, p);
    ledger.transfer(MINT, walletAcc(p), 500, 'grant');
    room.spawn(p);
  }
  const [a, b] = [...room.entities.values()] as Stomper[];
  a!.protectedUntil = b!.protectedUntil = 0;
  // both standing on the first ground island (top y = 1700)
  b!.x = 400;
  b!.y = 1700 - STOMP.hh;
  b!.vx = b!.vy = 0;
  return { room, ledger, a: a!, b: b! };
}

describe('Stomp Stake', () => {
  it('landing on a head eliminates and pays the stomper 80%', () => {
    const { room, ledger, a, b } = duel(1);
    const house0 = ledger.balance(HOUSE);
    a.x = b.x;
    a.y = b.y - STOMP.hh * 2 - 20;
    a.vy = 700;
    a.grounded = false;
    for (let i = 0; i < 4 && b.alive; i++) room.step();
    expect(b.alive).toBe(false);
    expect(a.vy).toBeLessThan(0); // bounced off
    expect(room.stakeOf(a)).toBe(180);
    expect(ledger.balance(HOUSE) - house0).toBe(20);
  });

  it('jumping up into someone is a head-bonk: nobody dies', () => {
    const { room, a, b } = duel(2);
    a.x = b.x;
    a.y = b.y - STOMP.hh * 2 - 10;
    a.vy = 700;
    a.grounded = false;
    b.vy = -900;
    b.grounded = false;
    room.step();
    expect(a.alive && b.alive).toBe(true);
  });

  it('falling into lava after a bump credits the bumper', () => {
    const { room, ledger, a, b } = duel(3);
    const house0 = ledger.balance(HOUSE);
    b.lastHit = { by: a.id, tick: room.tick };
    a.x = 200;
    b.x = 1800;
    b.y = STOMP.lavaY;
    room.step();
    expect(b.alive).toBe(false);
    expect(room.stakeOf(a)).toBe(180);
    expect(ledger.balance(HOUSE) - house0).toBe(20);
  });

  it('one double jump per airtime, ground pound only in the air', () => {
    const { room, a } = duel(4);
    a.x = 300;
    a.y = 1700 - STOMP.hh;
    room.step();
    room.setInput('a', { skill2: true });
    room.step();
    expect(a.pounding).toBe(false); // grounded: refused
    room.setInput('a', { skill1: true });
    room.step();
    expect(a.vy).toBeLessThan(0);
    room.setInput('a', { skill1: false });
    for (let i = 0; i < 3; i++) room.step();
    room.setInput('a', { skill1: true });
    room.step();
    expect(a.canDouble).toBe(false);
    room.setInput('a', { skill1: false });
    room.step();
    const vy = a.vy;
    room.setInput('a', { skill1: true });
    room.step();
    expect(a.vy).toBeGreaterThan(vy - 1); // no third jump
  });

  it('conserves credits over a long chaotic session', () => {
    const ledger = new MemoryLedger();
    const room = new Room(stompGame, { seed: 81, ledger, targetPopulation: 14 });
    const rng = new Rng(82);
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
        else room.setInput(p, { dx: rng.range(-1, 1), dy: rng.range(-1, 1), skill1: rng.chance(0.1), skill2: rng.chance(0.03), cashout: rng.chance(0.1) });
      }
      room.step();
      for (const ev of room.lastEvents) if (ev.t === 'kill') kills++;
      if (t % 500 === 0) assertLedgerInvariants(ledger, room);
    }
    assertLedgerInvariants(ledger, room);
    expect(kills).toBeGreaterThan(30);
  }, 60_000);
});
