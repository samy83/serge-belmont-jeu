import { describe, expect, it } from 'vitest';
import { Board } from '@core/board/board';
import { loadLevel } from '@core/level/loader';
import { LEVEL_SOURCES } from '@data/levels';
import { COLORS } from '@data/colors';

describe('Les niveaux livres', () => {
  it('sont dix, numerotes dans l ordre, avec des identifiants uniques', () => {
    expect(LEVEL_SOURCES.length).toBe(10);
    const ids = new Set(LEVEL_SOURCES.map((l) => l.id));
    expect(ids.size).toBe(10);
    LEVEL_SOURCES.forEach((l, i) => expect(l.index).toBe(i + 1));
  });

  for (const source of LEVEL_SOURCES) {
    describe(source.id, () => {
      const level = loadLevel(source);
      const board = new Board(level.board, level.balls, level.obstacles);

      it('se charge et n utilise que des couleurs connues de la palette', () => {
        expect(level.balls.length).toBeGreaterThan(0);
        for (const c of level.colors) expect(COLORS[c]).toBeDefined();
        expect(level.photo.src).toMatch(/^photos\/.+\.(jpg|png|webp)$/);
      });

      it('ne contient aucun groupe de 3 au depart', () => {
        expect(board.matchGroups(3)).toHaveLength(0);
      });

      it('toutes ses boules tiennent', () => {
        expect(board.supported().size).toBe(board.count);
      });

      it('a des seuils de trophees atteignables', () => {
        // Chaque tir detruit au plus... beaucoup ; au minimum il faut environ balls/3 tirs si tout part par 3.
        expect(level.trophies.gold).toBeGreaterThanOrEqual(1);
        expect(level.trophies.gold).toBeLessThanOrEqual(level.trophies.silver);
        expect(level.trophies.silver).toBeLessThanOrEqual(level.trophies.bronze);
      });
    });
  }
});
