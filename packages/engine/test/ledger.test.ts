import { describe, expect, it } from 'vitest';
import { HOUSE, InsufficientFunds, MINT, MemoryLedger, walletAcc } from '../src';

describe('MemoryLedger', () => {
  it('moves credits and keeps a zero sum', () => {
    const l = new MemoryLedger();
    l.transfer(MINT, walletAcc('a'), 500, 'grant');
    l.transfer(walletAcc('a'), 'stake:r:1', 100, 'spawn_stake');
    expect(l.balance(walletAcc('a'))).toBe(400);
    expect(l.balance(MINT)).toBe(-500);
    const sum = [...l.balances().values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it('refuses overdrafts on player accounts but lets house/mint go negative', () => {
    const l = new MemoryLedger();
    expect(() => l.transfer(walletAcc('a'), HOUSE, 1, 'house_cut')).toThrow(InsufficientFunds);
    l.transfer(HOUSE, 'stake:r:9', 100, 'bot_fund');
    expect(l.balance(HOUSE)).toBe(-100);
  });

  it('rejects invalid amounts and self transfers', () => {
    const l = new MemoryLedger();
    expect(() => l.transfer(MINT, 'x', 0, 'grant')).toThrow();
    expect(() => l.transfer(MINT, 'x', 1.25, 'grant')).toThrow();
    expect(() => l.transfer(MINT, 'x', -5, 'grant')).toThrow();
    expect(() => l.transfer(MINT, MINT, 5, 'grant')).toThrow();
    expect(() => l.transfer(MINT, 'x', Number.NaN, 'grant')).toThrow();
  });

  it('rows are immutable and replay to the same balances', () => {
    const l = new MemoryLedger();
    l.transfer(MINT, 'a', 10, 'grant');
    l.transfer('a', 'b', 4, 'cashout');
    const row = l.entries[0]!;
    expect(() => {
      (row as { amount: number }).amount = 999;
    }).toThrow();
    expect(MemoryLedger.replay(l.entries)).toEqual(l.balances());
  });
});
