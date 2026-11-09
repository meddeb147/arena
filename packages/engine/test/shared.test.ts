import { describe, expect, it } from 'vitest';
import { DEFAULT_FEATURES, KILLER_SHARE_PCT, Rng, formatCredits, splitKill } from '@arena/shared';

describe('shared rules', () => {
  it('real money is hard-disabled', () => {
    expect(DEFAULT_FEATURES.realMoney).toBe(false);
  });

  it('kill split is 80/20 and integer-exact', () => {
    expect(KILLER_SHARE_PCT).toBe(80);
    expect(splitKill(100)).toEqual({ killer: 80, house: 20 });
    for (let s = 0; s < 5000; s += 7) {
      const { killer, house } = splitKill(s);
      expect(killer + house).toBe(s);
      expect(Number.isInteger(killer)).toBe(true);
      expect(killer).toBeLessThanOrEqual(Math.floor(s * 0.8));
    }
  });

  it('rejects fractional or negative credits', () => {
    expect(() => splitKill(1.5)).toThrow();
    expect(() => splitKill(-1)).toThrow();
  });

  it('formats credits', () => {
    expect(formatCredits(150)).toBe('1.50');
    expect(formatCredits(5)).toBe('0.05');
    expect(formatCredits(-230)).toBe('-2.30');
  });

  it('rng is deterministic', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});
