import { describe, expect, it } from 'vitest';
import { GameSession } from '@core/game/session';
import { makeLevel, top } from '../helpers';

describe('GameSession', () => {
  it('vise vers un point, jamais sous l horizontale', () => {
    const s = new GameSession(makeLevel([top(450, 'ruby')]));
    const up = s.aimDirection(s.cannonX, 100)!;
    expect(up.x).toBeCloseTo(0, 6);
    expect(up.y).toBeCloseTo(-1, 6);
    const flat = s.aimDirection(s.cannonX + 500, s.cannonY + 300)!;
    expect(flat.y).toBeLessThan(0);
    expect(Math.atan2(-flat.y, flat.x)).toBeCloseTo((8 * Math.PI) / 180, 6);
  });

  it('deplace le canon dans ses limites', () => {
    const s = new GameSession(makeLevel([top(450, 'ruby')]));
    s.setCannonX(-1000);
    expect(s.cannonX).toBe(s.level.cannon.minX);
    s.setCannonX(5000);
    expect(s.cannonX).toBe(s.level.cannon.maxX);
  });

  it('un tir compte, pose la boule avec la couleur du canon et la ligne de visee dit vrai', () => {
    const s = new GameSession(makeLevel([top(450, 'sapphire')]));
    const dir = s.aimDirection(450, 100)!;
    const predicted = s.predict(dir);
    const shot = s.fire(dir);
    expect(shot.shotIndex).toBe(1);
    expect(s.shots).toBe(1);
    expect(shot.color).toBe('ruby');
    expect(shot.flight.endX).toBeCloseTo(predicted.endX, 9);
    expect(shot.flight.endY).toBeCloseTo(predicted.endY, 9);
    expect(shot.ballId).toBeDefined();
    expect(s.board.get(shot.ballId!)!.color).toBe('ruby');
    expect(shot.won).toBe(false);
  });

  it('gagne quand il ne reste plus aucune boule', () => {
    const s = new GameSession(makeLevel([top(408, 'ruby'), top(492, 'ruby')]));
    s.setCannonX(450);
    const shot = s.fire({ x: 0, y: -1 });
    expect(shot.resolution.matched).toBe(3);
    expect(shot.won).toBe(true);
    expect(s.state).toBe('won');
    expect(s.trophy()).toBe('gold');
    expect(() => s.fire({ x: 0, y: -1 })).toThrow();
  });

  it('la couleur du canon defile avec le temps et se fige pendant le vol si le niveau le demande', () => {
    const s = new GameSession(makeLevel([top(450, 'ruby')], { colorSequence: { intervalMs: 1000, warningMs: 100, pauseDuringFlight: true } }));
    s.update(1000, true);
    expect(s.currentColor).toBe('ruby');
    s.update(1000, false);
    expect(s.currentColor).toBe('sapphire');
    expect(s.timeMs).toBe(2000);
  });
});
