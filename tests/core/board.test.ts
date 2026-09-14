import { describe, expect, it } from 'vitest';
import { Board, circleCircleIntersections } from '@core/board/board';
import { below, makeLevel, top } from '../helpers';

const R = 42;
const ROW = R * Math.sqrt(3);

describe('Board : contacts et groupes', () => {
  it('detecte les voisins tangents et ignore les boules eloignees', () => {
    const level = makeLevel([top(100, 'ruby'), top(184, 'ruby'), top(400, 'ruby')]);
    const board = new Board(level.board, level.balls, level.obstacles);
    const [a, b, c] = board.all();
    expect(board.neighbors(a!).map((n) => n.id)).toEqual([b!.id]);
    expect(board.neighbors(c!)).toHaveLength(0);
  });

  it('deux boules identiques collees ne font PAS un groupe de 3', () => {
    const level = makeLevel([top(100, 'ruby'), top(184, 'ruby')]);
    const board = new Board(level.board, level.balls, level.obstacles);
    expect(board.colorGroup(1)).toHaveLength(2);
    expect(board.matchGroups(3)).toHaveLength(0);
  });

  it('trois boules connectees de meme couleur forment un groupe, la couleur differente coupe', () => {
    const level = makeLevel([top(100, 'ruby'), top(184, 'sapphire'), top(268, 'ruby'), below(184, R, 'ruby', -1), below(184, R, 'ruby', 1)]);
    const board = new Board(level.board, level.balls, level.obstacles);
    // Les deux rubis du bas touchent chacun un rubis du haut ET se touchent entre eux : groupe de 4.
    const g = board.colorGroup(4);
    expect(g.sort()).toEqual([1, 3, 4, 5]);
    expect(board.matchGroups(3)).toHaveLength(1);
  });
});

describe('Board : soutien', () => {
  it('une boule au plafond tient, une boule isolee en l air ne tient pas', () => {
    const level = makeLevel([top(100, 'ruby'), { x: 400, y: 600, color: 'sapphire' }]);
    const board = new Board(level.board, level.balls, level.obstacles);
    const s = board.supported();
    expect(s.has(1)).toBe(true);
    expect(s.has(2)).toBe(false);
  });

  it('le soutien se propage par contact', () => {
    const t = top(100, 'ruby');
    const b1 = below(t.x, t.y, 'sapphire');
    const b2 = below(b1.x, b1.y, 'emerald', -1);
    const level = makeLevel([t, b1, b2]);
    const board = new Board(level.board, level.balls, level.obstacles);
    expect(board.supported().size).toBe(3);
    board.remove([1]);
    expect(board.supported().size).toBe(0);
  });

  it('un obstacle gris est une ancre quand le niveau le dit', () => {
    const balls = [{ x: 300, y: 600, color: 'ruby' }];
    const obstacles = [{ x: 200, y: 642, w: 200, h: 60 }];
    const withAnchor = makeLevel(balls, {}, obstacles);
    const board = new Board(withAnchor.board, withAnchor.balls, withAnchor.obstacles);
    expect(board.supported().has(1)).toBe(true);
    const without = makeLevel(balls, { board: { anchors: { obstacles: false } } }, obstacles);
    const board2 = new Board(without.board, without.balls, without.obstacles);
    expect(board2.supported().has(1)).toBe(false);
  });

  it('une boule marquee anchored tient toute seule', () => {
    const level = makeLevel([{ x: 400, y: 600, color: 'ruby', anchored: true }]);
    const board = new Board(level.board, level.balls, level.obstacles);
    expect(board.supported().has(1)).toBe(true);
  });
});

describe('Board : blottissement', () => {
  it('blottit une boule posee contre une boule pour toucher aussi sa voisine proche', () => {
    const level = makeLevel([top(400, 'ruby'), top(484, 'sapphire')]);
    const board = new Board(level.board, level.balls, level.obstacles);
    // Contact avec la boule 1 (distance ~2R), legerement a cote de la position "hex" ideale (442, R+ROW).
    const contact = { x: 442 - 8, y: R + ROW + 3 };
    const p = board.nestle(contact.x, contact.y, 1);
    expect(Math.hypot(p.x - 400, p.y - R)).toBeCloseTo(2 * R, 4);
    expect(Math.hypot(p.x - 484, p.y - R)).toBeCloseTo(2 * R, 4);
  });

  it('ne bouge pas quand aucune deuxieme boule n est proche', () => {
    const level = makeLevel([top(400, 'ruby')]);
    const board = new Board(level.board, level.balls, level.obstacles);
    const p = board.nestle(400, R + 2 * R, 1);
    expect(p).toEqual({ x: 400, y: R + 2 * R });
  });

  it('intersections de deux cercles', () => {
    expect(circleCircleIntersections(0, 0, 10, 30, 0, 10)).toHaveLength(0);
    expect(circleCircleIntersections(0, 0, 10, 20, 0, 10)).toHaveLength(1);
    const two = circleCircleIntersections(0, 0, 10, 10, 0, 10);
    expect(two).toHaveLength(2);
    expect(two[0]!.x).toBeCloseTo(5, 6);
  });
});
