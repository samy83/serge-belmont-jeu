import { describe, expect, it } from 'vitest';
import { ColorSequencer } from '@core/rules/colorSequencer';
import { bestTrophy, evaluateTrophy, shotsUntilDowngrade } from '@core/rules/trophies';

const def = { sequence: ['ruby', 'sapphire', 'emerald'], intervalMs: 1000, warningMs: 200, startIndex: 0, pauseDuringFlight: false };

describe('ColorSequencer', () => {
  it('suit la sequence, dans l ordre, a intervalles reguliers', () => {
    const s = new ColorSequencer(def);
    expect(s.current).toBe('ruby');
    expect(s.next).toBe('sapphire');
    expect(s.update(999)).toBe(0);
    expect(s.current).toBe('ruby');
    expect(s.update(1)).toBe(1);
    expect(s.current).toBe('sapphire');
    expect(s.update(2000)).toBe(2);
    expect(s.current).toBe('ruby');
    expect(s.totalChanges).toBe(3);
    expect(s.upcoming(2)).toEqual(['sapphire', 'emerald']);
  });

  it('signale le changement imminent pendant la fenetre d avertissement', () => {
    const s = new ColorSequencer(def);
    s.update(700);
    expect(s.isWarning).toBe(false);
    expect(s.warningIntensity).toBe(0);
    s.update(150);
    expect(s.isWarning).toBe(true);
    expect(s.warningIntensity).toBeCloseTo(0.25, 6);
    expect(s.timeToChangeMs).toBe(150);
    expect(s.progress).toBeCloseTo(0.85, 6);
  });

  it('est deterministe et respecte startIndex', () => {
    const a = new ColorSequencer({ ...def, startIndex: 2 });
    const b = new ColorSequencer({ ...def, startIndex: 2 });
    expect(a.current).toBe('emerald');
    a.update(333);
    b.update(111);
    b.update(222);
    expect(a.current).toBe(b.current);
    expect(a.timeToChangeMs).toBe(b.timeToChangeMs);
  });
});

describe('Trophees', () => {
  const t = { metric: 'shots' as const, gold: 5, silver: 8, bronze: 12 };
  const result = { timeMs: 0, matches: 0, maxChain: 0, ballsMatched: 0, ballsDropped: 0 };

  it('attribue le palier selon le nombre de tirs', () => {
    expect(evaluateTrophy(t, { ...result, shots: 5 })).toBe('gold');
    expect(evaluateTrophy(t, { ...result, shots: 6 })).toBe('silver');
    expect(evaluateTrophy(t, { ...result, shots: 12 })).toBe('bronze');
    expect(evaluateTrophy(t, { ...result, shots: 13 })).toBe('none');
  });

  it('garde le meilleur trophee', () => {
    expect(bestTrophy('silver', 'gold')).toBe('gold');
    expect(bestTrophy('bronze', 'none')).toBe('bronze');
  });

  it('dit combien de tirs restent avant de perdre un palier', () => {
    expect(shotsUntilDowngrade(t, 3)).toEqual({ tier: 'gold', remaining: 2 });
    expect(shotsUntilDowngrade(t, 9)).toEqual({ tier: 'bronze', remaining: 3 });
  });
});
