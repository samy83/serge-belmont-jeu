import { describe, expect, it } from 'vitest';
import { LevelError, expandLayout, loadLevel } from '@core/level/loader';

describe('loadLevel', () => {
  it('complete les defauts et garde les valeurs fournies', () => {
    const level = loadLevel({
      id: 'x',
      photo: { src: 'photos/x.jpg' },
      balls: [{ x: 100, y: 42, color: 'ruby' }],
      trophies: { gold: 3, silver: 5, bronze: 8 },
    });
    expect(level.board.width).toBe(900);
    expect(level.board.ballRadius).toBe(42);
    expect(level.board.anchors.top).toBe(true);
    expect(level.trophies.gold).toBe(3);
    expect(level.colorSequence.sequence).toEqual(['ruby', 'sapphire', 'emerald']);
    expect(level.cannon.y).toBeGreaterThan(level.board.floorY);
  });

  it('refuse un niveau sans boule, des seuils incoherents ou une couleur inconnue', () => {
    expect(() => loadLevel({ id: 'a', photo: { src: 'p' } })).toThrow(LevelError);
    expect(() =>
      loadLevel({ id: 'b', photo: { src: 'p' }, balls: [{ x: 100, y: 42, color: 'ruby' }], trophies: { gold: 9, silver: 5, bronze: 8 } }),
    ).toThrow(/trophees/);
    expect(() => loadLevel({ id: 'c', photo: { src: 'p' }, balls: [{ x: 100, y: 42, color: 'onyx' }] })).toThrow(/couleur inconnue/);
  });

  it('refuse deux boules qui se chevauchent', () => {
    expect(() =>
      loadLevel({
        id: 'd',
        photo: { src: 'p' },
        balls: [
          { x: 100, y: 42, color: 'ruby' },
          { x: 130, y: 42, color: 'sapphire' },
        ],
      }),
    ).toThrow(/chevauchent/);
  });
});

describe('expandLayout', () => {
  const board = { width: 900, ballRadius: 42 };
  const legend = { R: 'ruby', S: 'sapphire', '#': 'block' as const, '.': '' as const };

  it('place les rangees en empilement hexagonal, collees au plafond, centrees', () => {
    const { balls, obstacles } = expandLayout({ rows: ['RS', 'SR'], legend }, board, 't');
    expect(obstacles).toHaveLength(0);
    expect(balls).toHaveLength(4);
    expect(balls[0]!.y).toBe(42);
    expect(balls[2]!.y).toBeCloseTo(42 + 84 * Math.sqrt(3) / 2, 1);
    // La rangee impaire est decalee d'un demi-diametre.
    expect(balls[2]!.x - balls[0]!.x).toBeCloseTo(42, 1);
    // L'ensemble (2 cellules + demi-decalage) est centre sur le plateau.
    const minX = Math.min(...balls.map((b) => b.x)) - 42;
    const maxX = Math.max(...balls.map((b) => b.x)) + 42;
    expect(minX).toBeCloseTo(900 - maxX, 1);
    // Les voisins hexagonaux sont exactement tangents.
    expect(Math.hypot(balls[2]!.x - balls[0]!.x, balls[2]!.y - balls[0]!.y)).toBeCloseTo(84, 1);
  });

  it('fusionne les cases grises contigues en un obstacle et les rend tangentes aux boules voisines', () => {
    const { balls, obstacles } = expandLayout({ rows: ['R##R', 'RRRR'], legend }, board, 't');
    expect(obstacles).toHaveLength(1);
    const o = obstacles[0]!;
    expect(o.w).toBeCloseTo(168, 1);
    const rowStep = 84 * Math.sqrt(3) / 2;
    expect(o.h).toBeCloseTo(2 * rowStep - 84, 1);
    // Boule de la rangee suivante, en diagonale sous la case : tangente (distance = rayon).
    const under = balls.find((b) => b.y > 50 && Math.abs(b.x - o.x) < 1)!;
    const cx = Math.max(o.x, Math.min(under.x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(under.y, o.y + o.h));
    expect(Math.hypot(under.x - cx, under.y - cy)).toBeCloseTo(42, 1);
  });

  it('refuse un caractere absent de la legende', () => {
    expect(() => expandLayout({ rows: ['RZ'], legend }, board, 't')).toThrow(/legende/);
  });
});
