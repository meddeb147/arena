import { MemoryLedger, MINT, Room, blobGame, walletAcc, type Ledger } from '../src';

export function makeRoom(seed = 42, opts: { target?: number; ledger?: Ledger } = {}) {
  const ledger = (opts.ledger as MemoryLedger) ?? new MemoryLedger();
  const room = new Room(blobGame, { seed, ledger, targetPopulation: opts.target ?? 16 });
  return { room, ledger };
}

export function grant(ledger: Ledger, playerId: string, units: number) {
  ledger.transfer(MINT, walletAcc(playerId), units, 'grant');
}

/** Every ledger invariant that must hold at any tick. */
export function assertLedgerInvariants(ledger: MemoryLedger, room: Room<any, any, any>) {
  const balances = ledger.balances();
  let sum = 0;
  for (const [acc, v] of balances) {
    sum += v;
    if (!Number.isSafeInteger(v)) throw new Error(`non-integer balance ${acc}=${v}`);
    if (acc !== 'house' && acc !== 'mint' && v < 0) throw new Error(`negative balance ${acc}=${v}`);
  }
  if (sum !== 0) throw new Error(`ledger does not sum to zero: ${sum}`);

  // balances are derivable from rows alone
  const replayed = MemoryLedger.replay(ledger.entries);
  for (const [acc, v] of balances) {
    if ((replayed.get(acc) ?? 0) !== v) throw new Error(`cache mismatch on ${acc}`);
  }

  // only live entities hold stake
  const live = new Set([...room.entities.values()].filter((e) => e.alive).map((e) => `stake:${room.roomId}:${e.id}`));
  for (const [acc, v] of balances) {
    if (acc.startsWith('stake:') && v !== 0 && !live.has(acc)) throw new Error(`orphan stake ${acc}=${v}`);
  }
}
