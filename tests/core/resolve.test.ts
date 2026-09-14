import { describe, expect, it } from 'vitest';
import { Board } from '@core/board/board';
import { resolveBoard, settle } from '@core/board/resolve';
import { below, makeLevel, top } from '../helpers';

const R = 42;
const ROW = R * Math.sqrt(3);

function boardFrom(level: ReturnType<typeof makeLevel>): Board {
  return new Board(level.board, level.balls, level.obstacles);
}

describe('resolveBoard : regle des 3', () => {
  it('une boule qui rejoint une seule boule identique ne detruit rien', () => {
    const board = boardFrom(makeLevel([top(300, 'ruby')]));
    const landed = board.addBall(342, R + ROW, 'ruby');
    const res = resolveBoard(board, { settle: 'land' }, landed.id);
    expect(res.steps).toHaveLength(0);
    expect(board.count).toBe(2);
  });

  it('une boule qui rejoint une paire identique detruit les trois', () => {
    const board = boardFrom(makeLevel([top(300, 'ruby'), top(384, 'ruby')]));
    const landed = board.addBall(342, R + ROW, 'ruby');
    const res = resolveBoard(board, { settle: 'land' }, landed.id);
    expect(res.steps).toHaveLength(1);
    expect(res.steps[0]!.type).toBe('match');
    expect(res.matched).toBe(3);
    expect(res.chainLength).toBe(0);
    expect(board.count).toBe(0);
  });
});

describe('resolveBoard : chutes', () => {
  it('ce qui ne tient plus tombe et quitte le niveau s il n y a rien dessous', () => {
    const hanging = below(384, R, 'sapphire', 1);
    const board = boardFrom(makeLevel([top(300, 'ruby'), top(384, 'ruby'), hanging]));
    const landed = board.addBall(342, R + ROW, 'ruby');
    const res = resolveBoard(board, { settle: 'land' }, landed.id);
    expect(res.steps.map((s) => s.type)).toEqual(['match', 'fall']);
    const fall = res.steps[1]!;
    if (fall.type !== 'fall') throw new Error('attendu : fall');
    expect(fall.clusters).toHaveLength(1);
    expect(fall.clusters[0]!.landed).toBe(false);
    expect(fall.clusters[0]!.distance).toBeCloseTo(1280 - hanging.y, 2);
    expect(res.dropped).toBe(1);
    expect(board.count).toBe(0);
  });

  it('une grappe qui tombe se pose sur ce qui tient et peut declencher une reaction en chaine', () => {
    const e1 = below(384, R, 'emerald', 1);
    const e2 = { x: e1.x, y: e1.y + 2 * R, color: 'emerald' };
    const obstacle = { x: 380, y: 500, w: 120, h: 60 };
    const e3 = { x: 440, y: 500 - R, color: 'emerald' };
    const level = makeLevel([top(300, 'ruby'), top(384, 'ruby'), top(600, 'sapphire'), e1, e2, e3], {}, [obstacle]);
    const board = boardFrom(level);
    expect(board.supported().size).toBe(6);

    const landed = board.addBall(342, R + ROW, 'ruby');
    const res = resolveBoard(board, { settle: 'land' }, landed.id);
    expect(res.steps.map((s) => s.type)).toEqual(['match', 'fall', 'match']);
    const fall = res.steps[1]!;
    if (fall.type !== 'fall') throw new Error('attendu : fall');
    expect(fall.clusters[0]!.landed).toBe(true);
    const expected = e3.y - Math.sqrt(4 * R * R - (e1.x - e3.x) ** 2) - e2.y;
    expect(fall.clusters[0]!.distance).toBeCloseTo(expected, 2);
    expect(res.chainLength).toBe(1);
    expect(res.matches).toBe(2);
    expect(res.matched).toBe(6);
    // Il ne reste que le saphir du plafond.
    expect(board.all().map((b) => b.color)).toEqual(['sapphire']);
  });

  it('en mode "drop", tout ce qui ne tient plus quitte le niveau sans se poser', () => {
    const e1 = below(384, R, 'emerald', 1);
    const e2 = { x: e1.x, y: e1.y + 2 * R, color: 'emerald' };
    const obstacle = { x: 380, y: 500, w: 120, h: 60 };
    const e3 = { x: 440, y: 500 - R, color: 'emerald' };
    const board = boardFrom(makeLevel([top(300, 'ruby'), top(384, 'ruby'), e1, e2, e3], { physics: { settle: 'drop' } }, [obstacle]));
    const landed = board.addBall(342, R + ROW, 'ruby');
    const res = resolveBoard(board, { settle: 'drop' }, landed.id);
    expect(res.steps.map((s) => s.type)).toEqual(['match', 'fall']);
    expect(res.dropped).toBe(2);
    expect(board.count).toBe(1);
  });

  it('settle : plusieurs grappes tombent ensemble, la premiere posee soutient la suivante', () => {
    // Deux boules superposees a la verticale, aucune ne tient ; un appui sous la basse.
    const support = { x: 450, y: 900, color: 'ruby', anchored: true };
    const low = { x: 450, y: 400, color: 'sapphire' };
    const high = { x: 450, y: 200, color: 'emerald' };
    const board = boardFrom(makeLevel([support, low, high]));
    const falls = settle(board, 'land');
    expect(falls).toHaveLength(2);
    const lowFall = falls.find((f) => f.ballIds.includes(2))!;
    const highFall = falls.find((f) => f.ballIds.includes(3))!;
    expect(lowFall.landed).toBe(true);
    expect(lowFall.distance).toBeCloseTo(900 - 84 - 400, 2);
    expect(highFall.landed).toBe(true);
    expect(highFall.distance).toBeCloseTo(900 - 168 - 200, 2);
    expect(board.get(3)!.y).toBeCloseTo(900 - 168, 2);
  });
});
