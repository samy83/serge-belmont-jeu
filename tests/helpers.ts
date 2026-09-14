import { loadLevel } from '@core/level/loader';
import type { BallDef, LevelDef, LevelSource, ObstacleDef } from '@core/model/types';

/** Niveau minimal de test : plateau 900x1600, rayon 42, boules explicites. */
export function makeLevel(balls: BallDef[], extra: Partial<LevelSource> = {}, obstacles: ObstacleDef[] = []): LevelDef {
  return loadLevel({
    id: 'test',
    photo: { src: 'photos/test.jpg' },
    balls,
    obstacles,
    ...extra,
  });
}

/** Une boule collee au plafond a l'abscisse x. */
export function top(x: number, color: string, r = 42): BallDef {
  return { x, y: r, color };
}

/** Une boule en contact exact sous (x, y), decalee d'un demi-diametre (empilement hex). */
export function below(x: number, y: number, color: string, side: -1 | 1 = 1, r = 42): BallDef {
  return { x: x + side * r, y: y + r * Math.sqrt(3), color };
}
