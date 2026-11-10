import { describe, expect, it } from 'vitest';
import { COLOR_UNLOCK, MISSION_XP, applyEvent, colorUnlocked, dailyMissions, freshProgress, levelFor, lifeXp, touchDay, xpForLevel } from '../src/progress';

describe('progression', () => {
  it('levels follow the XP curve both ways', () => {
    expect(levelFor(0)).toBe(1);
    for (let l = 1; l < 30; l++) {
      expect(levelFor(xpForLevel(l))).toBe(l);
      expect(levelFor(xpForLevel(l + 1) - 1)).toBe(l);
    }
  });

  it('daily missions: three distinct, stable for a date, change between dates', () => {
    const a = dailyMissions('2026-11-10');
    expect(a).toHaveLength(3);
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
    expect(dailyMissions('2026-11-10')).toEqual(a);
    const sets = new Set(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'].map((d) => dailyMissions(d).map((m) => m.id).join()));
    expect(sets.size).toBeGreaterThan(1);
  });

  it('streak grows on consecutive days and resets after a gap', () => {
    const p = freshProgress();
    expect(touchDay(p, '2026-11-10')).toBe(20);
    expect(touchDay(p, '2026-11-10')).toBe(0);
    touchDay(p, '2026-11-11');
    expect(p.streak).toBe(2);
    touchDay(p, '2026-11-14');
    expect(p.streak).toBe(1);
  });

  it('missions complete once and pay XP', () => {
    const p = freshProgress();
    p.missions = [
      { id: 'kos', goal: 2, value: 0, done: false },
      { id: 'games', goal: 2, value: 0, done: false },
      { id: 'big', goal: 300, value: 0, done: false },
    ];
    expect(applyEvent(p, { t: 'ko' })).toHaveLength(0);
    expect(applyEvent(p, { t: 'ko' }).map((m) => m.id)).toEqual(['kos']);
    expect(p.xp).toBe(MISSION_XP);
    applyEvent(p, { t: 'ko' });
    expect(p.xp).toBe(MISSION_XP);
    applyEvent(p, { t: 'life', seconds: 10, game: 'blob' });
    applyEvent(p, { t: 'life', seconds: 10, game: 'blob' });
    expect(p.missions[1]!.done).toBe(false);
    applyEvent(p, { t: 'life', seconds: 10, game: 'volt' });
    expect(p.missions[1]!.done).toBe(true);
    applyEvent(p, { t: 'cashout', amount: 180 });
    expect(p.missions[2]!.done).toBe(false);
    applyEvent(p, { t: 'cashout', amount: 340 });
    expect(p.missions[2]!.done).toBe(true);
  });

  it('colours unlock by level; life XP is capped', () => {
    const p = freshProgress();
    expect(colorUnlocked(p, 0)).toBe(true);
    expect(colorUnlocked(p, 13)).toBe(false);
    p.xp = xpForLevel(COLOR_UNLOCK[13]!);
    expect(colorUnlocked(p, 13)).toBe(true);
    expect(lifeXp(100000, 0, 1e9)).toBe(260);
    expect(lifeXp(30, 2, 0)).toBe(50);
  });
});
