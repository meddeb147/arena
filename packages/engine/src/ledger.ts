import { assertUnits } from '@arena/shared';

/**
 * Account naming:
 *  - `wallet:<playerId>`  a player's spendable play credits
 *  - `stake:<roomId>:<entityId>` credits riding on a live entity
 *  - `house`              the house pot (receives cuts; funds bot stakes)
 *  - `mint`               the only source of new play credits (grants, daily rewards)
 *
 * Only `house` and `mint` may go negative. Every movement of credits is one
 * immutable transfer row; balances are a pure function of the rows.
 */
export type AccountId = string;

export type TransferReason =
  | 'grant' // mint -> wallet (signup bonus, daily reward, free refill)
  | 'spawn_stake' // wallet -> stake
  | 'kill_reward' // stake(victim) -> stake(killer), 80%
  | 'house_cut' // stake(victim) -> house, 20%
  | 'hazard_loss' // stake(victim) -> house, died without a killer
  | 'cashout' // stake -> wallet
  | 'bot_fund' // house -> stake(bot)
  | 'bot_refund' // stake(bot) -> house (bot cashed out / despawned)
  | 'bounty'; // house -> stake(killer), bonus for knocking out the King

export interface Transfer {
  readonly seq: number;
  readonly from: AccountId;
  readonly to: AccountId;
  readonly amount: number;
  readonly reason: TransferReason;
  readonly tick: number;
  readonly ref?: string;
}

const MAY_GO_NEGATIVE = new Set<AccountId>(['house', 'mint']);

export interface Ledger {
  transfer(from: AccountId, to: AccountId, amount: number, reason: TransferReason, tick?: number, ref?: string): Transfer;
  balance(account: AccountId): number;
}

export class InsufficientFunds extends Error {
  constructor(public readonly account: AccountId, public readonly needed: number, public readonly available: number) {
    super(`insufficient funds in ${account}: need ${needed}, have ${available}`);
  }
}

/**
 * In-memory append-only ledger. The balance map is a cache that can always be
 * rebuilt from `entries` (see `replay`). Step 3 adds a PostgreSQL sink that
 * persists each row via `onTransfer`.
 */
export class MemoryLedger implements Ledger {
  private readonly rows: Transfer[] = [];
  private readonly cache = new Map<AccountId, number>();
  private readonly listeners: Array<(t: Transfer) => void> = [];

  get entries(): readonly Transfer[] {
    return this.rows;
  }

  onTransfer(fn: (t: Transfer) => void): void {
    this.listeners.push(fn);
  }

  transfer(from: AccountId, to: AccountId, amount: number, reason: TransferReason, tick = 0, ref?: string): Transfer {
    assertUnits(amount);
    if (amount === 0) throw new Error('zero-amount transfer');
    if (from === to) throw new Error(`self-transfer on ${from}`);
    const available = this.balance(from);
    if (!MAY_GO_NEGATIVE.has(from) && available < amount) {
      throw new InsufficientFunds(from, amount, available);
    }
    const row: Transfer = Object.freeze({ seq: this.rows.length + 1, from, to, amount, reason, tick, ...(ref ? { ref } : {}) });
    this.rows.push(row);
    this.cache.set(from, available - amount);
    this.cache.set(to, this.balance(to) + amount);
    for (const fn of this.listeners) fn(row);
    return row;
  }

  balance(account: AccountId): number {
    return this.cache.get(account) ?? 0;
  }

  /** Rebuild every balance from the rows alone. */
  static replay(rows: readonly Transfer[]): Map<AccountId, number> {
    const m = new Map<AccountId, number>();
    for (const r of rows) {
      m.set(r.from, (m.get(r.from) ?? 0) - r.amount);
      m.set(r.to, (m.get(r.to) ?? 0) + r.amount);
    }
    return m;
  }

  /** All balances; they always sum to exactly zero (double entry). */
  balances(): Map<AccountId, number> {
    return new Map(this.cache);
  }
}

export const walletAcc = (playerId: string): AccountId => `wallet:${playerId}`;
export const stakeAcc = (roomId: string, entityId: number): AccountId => `stake:${roomId}:${entityId}`;
export const HOUSE: AccountId = 'house';
export const MINT: AccountId = 'mint';
