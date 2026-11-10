import { KILLER_SHARE_PCT } from './constants';

/** Split a victim's stake between killer and house. Integer-exact: killer + house === stake. */
export function splitKill(stake: number): { killer: number; house: number } {
  assertUnits(stake);
  const killer = Math.floor((stake * KILLER_SHARE_PCT) / 100);
  return { killer, house: stake - killer };
}

export function assertUnits(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(`invalid credit amount: ${amount}`);
  }
}

/**
 * Players see whole units ("coins"): 1 credit = 100. Big round numbers read
 * better on screen and in clips ("+80" rather than "+0.80"). 1250 -> "1,250"
 */
export function formatCredits(units: number): string {
  const sign = units < 0 ? '-' : '';
  return sign + Math.abs(Math.round(units)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
