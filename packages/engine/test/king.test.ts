import { describe, expect, it } from 'vitest';
import { EntFlag, KING_MIN_STAKE } from '@arena/shared';
import { HOUSE, MINT, MemoryLedger, Room, stakeAcc, voltGame, walletAcc, type VoltFighter } from '../src';
import { voltDamage } from '../src/games/volt';
import { assertLedgerInvariants } from './helpers';

function room3() {
  const ledger = new MemoryLedger();
  const room = new Room(voltGame, { seed: 5, ledger, targetPopulation: 0 });
  for (const p of ['a', 'b', 'c']) {
    room.addPlayer(p, p);
    ledger.transfer(MINT, walletAcc(p), 1000, 'grant');
    room.spawn(p);
  }
  const ents = [...room.entities.values()] as VoltFighter[];
  for (const e of ents) e.protectedUntil = 0;
  return { room, ledger, a: ents[0]!, b: ents[1]!, c: ents[2]! };
}
/** give an entity extra stake through a proper ledger transfer (as if it had won kills) */
function boost(room: Room<any, any, any>, ledger: MemoryLedger, e: VoltFighter, units: number) {
  ledger.transfer(HOUSE, stakeAcc(room.roomId, e.id), units, 'bounty', room.tick);
}

describe('the King', () => {
  it('nobody is King below the threshold', () => {
    const { room } = room3();
    room.step();
    expect(room.kingId).toBeNull();
    expect(room.snapshotFor('a')!.king).toBeNull();
  });

  it('the richest player above the threshold is crowned and flagged', () => {
    const { room, ledger, b } = room3();
    boost(room, ledger, b, KING_MIN_STAKE);
    room.step();
    expect(room.kingId).toBe(b.id);
    expect(room.lastEvents.some((e) => e.t === 'king' && e.id === b.id)).toBe(true);
    const snap = room.snapshotFor('a')!;
    expect(snap.king?.id).toBe(b.id);
    const me = snap.ents.find((e) => e.id === b.id);
    expect((me?.f ?? 0) & EntFlag.King).toBeTruthy();
  });

  it('the crown must be taken, not tied', () => {
    const { room, ledger, b, c } = room3();
    boost(room, ledger, b, KING_MIN_STAKE);
    room.step();
    boost(room, ledger, c, KING_MIN_STAKE); // tie
    room.step();
    expect(room.kingId).toBe(b.id);
    boost(room, ledger, c, 1);
    room.step();
    expect(room.kingId).toBe(c.id);
  });

  it('knocking out the King pays 80% plus a 50% bounty from the house', () => {
    const { room, ledger, a, b } = room3();
    boost(room, ledger, b, 300); // b: 400 at stake
    room.step();
    expect(room.kingId).toBe(b.id);
    const house0 = ledger.balance(HOUSE);
    const aBefore = room.stakeOf(a);
    voltDamage(room, b, 999, a, 1, 0, 0);
    expect(b.alive).toBe(false);
    // 80% of 400 = 320 kill reward, 50% of 400 = 200 bounty
    expect(room.stakeOf(a) - aBefore).toBe(320 + 200);
    expect(ledger.balance(HOUSE) - house0).toBe(80 - 200);
    const ev = room.lastEvents.find((e) => e.t === 'kill');
    expect(ev).toMatchObject({ amount: 320, bounty: 200 });
    room.step();
    assertLedgerInvariants(ledger, room);
  });

  it('a King who dies to a hazard pays no bounty', () => {
    const { room, ledger, b } = room3();
    boost(room, ledger, b, 300);
    room.step();
    const house0 = ledger.balance(HOUSE);
    voltDamage(room, b, 999, null, 1, 0, 0);
    expect(ledger.balance(HOUSE) - house0).toBe(400);
    expect(room.kingId).toBeNull();
  });
});
