import { describe, expect, it } from 'vitest';
import { CASHOUT_HOLD_TICKS, RESPAWN_MIN_TICKS, Rng, SPAWN_PROTECTION_TICKS, SPAWN_STAKE } from '@arena/shared';
import { HOUSE, MemoryLedger, walletAcc, type BlobCell } from '../src';
import { assertLedgerInvariants, grant, makeRoom } from './helpers';

describe('Room + Blob Stake', () => {
  it('fills with bots up to the target population', () => {
    const { room } = makeRoom(1, { target: 12 });
    for (let i = 0; i < 60; i++) room.step();
    expect(room.botCount).toBe(12);
    expect([...room.entities.values()].filter((e) => e.alive).length).toBe(12);
    room.addPlayer('p1', 'Alice');
    expect(room.botCount).toBe(11);
  });

  it('spawning costs exactly one stake from the wallet', () => {
    const { room, ledger } = makeRoom();
    room.addPlayer('p1', 'Alice');
    expect(room.spawn('p1')).toEqual({ ok: false, reason: 'funds' });
    grant(ledger, 'p1', 300);
    const r = room.spawn('p1');
    expect(r.ok).toBe(true);
    expect(ledger.balance(walletAcc('p1'))).toBe(300 - SPAWN_STAKE);
    expect(room.spawn('p1')).toEqual({ ok: false, reason: 'alive' });
  });

  it('cash-out after a 3 s hold returns the stake to the wallet', () => {
    const { room, ledger } = makeRoom(3, { target: 0 });
    room.addPlayer('p1', 'Alice');
    grant(ledger, 'p1', 100);
    room.spawn('p1');
    room.setInput('p1', { cashout: true });
    for (let i = 0; i < CASHOUT_HOLD_TICKS - 1; i++) room.step();
    expect(room.snapshotFor('p1')!.you.state).toBe('alive');
    room.step();
    const you = room.snapshotFor('p1')!.you;
    expect(you.state).toBe('cashed');
    expect(you.wallet).toBe(100);
    assertLedgerInvariants(ledger, room);
  });

  it('releasing the cash-out button resets the hold', () => {
    const { room, ledger } = makeRoom(3, { target: 0 });
    room.addPlayer('p1', 'Alice');
    grant(ledger, 'p1', 100);
    room.spawn('p1');
    room.setInput('p1', { cashout: true });
    for (let i = 0; i < CASHOUT_HOLD_TICKS - 5; i++) room.step();
    room.setInput('p1', { cashout: false });
    room.step();
    room.setInput('p1', { cashout: true });
    for (let i = 0; i < 10; i++) room.step();
    expect(room.snapshotFor('p1')!.you.state).toBe('alive');
  });

  it('a kill pays 80% to the killer and 20% to the house', () => {
    const { room, ledger } = makeRoom(5, { target: 0 });
    for (const p of ['a', 'b']) {
      room.addPlayer(p, p);
      grant(ledger, p, 100);
      room.spawn(p);
    }
    const [a, b] = [...room.entities.values()] as BlobCell[];
    a!.protectedUntil = b!.protectedUntil = 0;
    const houseBefore = ledger.balance(HOUSE);
    // put the big one on top of the small one
    a!.mass = 200;
    a!.r = 6 * Math.sqrt(200);
    b!.x = a!.x;
    b!.y = a!.y;
    room.step();
    expect(b!.alive).toBe(false);
    expect(room.stakeOf(a!)).toBe(180);
    expect(ledger.balance(HOUSE) - houseBefore).toBe(20);
    const kill = room.lastEvents.find((ev) => ev.t === 'kill');
    expect(kill).toMatchObject({ amount: 80, houseCut: 20, cause: 'player' });
    assertLedgerInvariants(ledger, room);
  });

  it('shield prevents being eaten; cash-out cancels the shield', () => {
    const { room, ledger } = makeRoom(6, { target: 0 });
    for (const p of ['a', 'b']) {
      room.addPlayer(p, p);
      grant(ledger, p, 100);
      room.spawn(p);
    }
    const [a, b] = [...room.entities.values()] as BlobCell[];
    a!.protectedUntil = 0;
    room.setInput('b', { skill2: true });
    room.step();
    expect(b!.effects[1]).toBeGreaterThan(0);
    a!.mass = 200;
    a!.r = 6 * Math.sqrt(200);
    b!.x = a!.x;
    b!.y = a!.y;
    room.step();
    expect(b!.alive).toBe(true);
    room.setInput('b', { cashout: true });
    b!.x = a!.x;
    b!.y = a!.y;
    room.step();
    expect(b!.alive).toBe(false);
  });

  it('spawn protection blocks kills until it expires', () => {
    const { room, ledger } = makeRoom(7, { target: 0 });
    for (const p of ['a', 'b']) {
      room.addPlayer(p, p);
      grant(ledger, p, 100);
      room.spawn(p);
    }
    const [a, b] = [...room.entities.values()] as BlobCell[];
    a!.mass = 200;
    a!.r = 6 * Math.sqrt(200);
    const pin = () => {
      b!.x = a!.x;
      b!.y = a!.y;
    };
    pin();
    room.step();
    expect(b!.alive).toBe(true);
    expect(room.snapshotFor('b')!.ents.find((e) => e.id === b!.id)!.f! & 128).toBeTruthy();
    for (let i = 0; i < SPAWN_PROTECTION_TICKS + 1 && b!.alive; i++) {
      pin();
      room.step();
    }
    expect(b!.alive).toBe(false);
  });

  it('respawn is allowed within 3 seconds of death', () => {
    expect(RESPAWN_MIN_TICKS).toBeLessThan(90);
  });

  it('disconnecting while alive triggers an automatic cash-out', () => {
    const { room, ledger } = makeRoom(8, { target: 0 });
    room.addPlayer('p1', 'Alice');
    grant(ledger, 'p1', 100);
    room.spawn('p1');
    room.removePlayer('p1');
    for (let i = 0; i < CASHOUT_HOLD_TICKS + 2; i++) room.step();
    expect(ledger.balance(walletAcc('p1'))).toBe(100);
    expect(room.entities.size).toBe(0);
  });

  it('closing a room returns every stake without creating credits', () => {
    const { room, ledger } = makeRoom(11, { target: 16 });
    room.addPlayer('p1', 'Alice');
    grant(ledger, 'p1', 300);
    room.spawn('p1');
    for (let i = 0; i < 200; i++) room.step();
    const before = ledger.balance(walletAcc('p1'));
    const alive = room.snapshotFor('p1')!.you.stake;
    room.close();
    expect(ledger.balance(walletAcc('p1'))).toBe(before + alive);
    for (const [acc, v] of ledger.balances()) if (acc.startsWith('stake:')) expect(v).toBe(0);
    expect([...ledger.balances().values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const { room } = makeRoom(99);
      for (let i = 0; i < 600; i++) room.step();
      return [...room.entities.values()].map((e) => `${e.id}:${e.x.toFixed(3)}:${e.y.toFixed(3)}`).join('|');
    };
    expect(run()).toBe(run());
  });
});

describe('credit conservation (fuzz)', () => {
  it('no credits are created or lost across a long chaotic session', () => {
    const ledger = new MemoryLedger();
    const { room } = makeRoom(2024, { ledger, target: 20 });
    const rng = new Rng(77);
    const players = Array.from({ length: 6 }, (_, i) => `p${i}`);
    const granted = new Map<string, number>();
    let kills = 0;
    let cashouts = 0;

    for (let tick = 0; tick < 12000; tick++) {
      for (const p of players) {
        const joined = room.snapshotFor(p) !== null;
        if (!joined) {
          if (rng.chance(0.01) && room.hasSpaceForHuman()) {
            room.addPlayer(p, p);
            ledger.transfer('mint', walletAcc(p), 500, 'grant');
            granted.set(p, (granted.get(p) ?? 0) + 500);
          }
          continue;
        }
        const st = room.snapshotFor(p)!.you.state;
        if (st !== 'alive' && rng.chance(0.05)) room.spawn(p);
        if (rng.chance(0.002)) room.removePlayer(p);
        else
          room.setInput(p, {
            dx: rng.range(-1.5, 1.5),
            dy: rng.range(-1.5, 1.5),
            skill1: rng.chance(0.05),
            skill2: rng.chance(0.02),
            cashout: rng.chance(0.3) && st === 'alive' ? rng.chance(0.9) : false,
          });
      }
      room.step();
      for (const ev of room.lastEvents) {
        if (ev.t === 'kill') kills++;
        if (ev.t === 'cashout') cashouts++;
      }
      if (tick % 250 === 0) assertLedgerInvariants(ledger, room);
    }
    assertLedgerInvariants(ledger, room);

    // total money in the system equals what the mint granted
    const mintOut = -ledger.balance('mint');
    expect(mintOut).toBe([...granted.values()].reduce((a, b) => a + b, 0));
    expect(kills).toBeGreaterThan(10);
    expect(cashouts).toBeGreaterThan(0);
  }, 60_000);
});
