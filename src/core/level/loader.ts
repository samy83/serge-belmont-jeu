/**
 * Chargement d'un niveau : defauts, conversion de la disposition ASCII en
 * boules/obstacles, puis validation. Aucun acces reseau ici : on recoit un
 * objet JSON deja lu (import statique ou fetch fait par la couche plateforme).
 */
import type {
  BallDef,
  BoardDef,
  ColorId,
  LayoutDef,
  LevelDef,
  LevelSource,
  ObstacleDef,
} from '../model/types';

export const DEFAULT_BOARD_WIDTH = 900;
export const DEFAULT_BOARD_HEIGHT = 1600;
export const DEFAULT_BALL_RADIUS = 42;

export class LevelError extends Error {
  constructor(
    message: string,
    public readonly levelId: string,
  ) {
    super(`[niveau ${levelId}] ${message}`);
    this.name = 'LevelError';
  }
}

/** Convertit une disposition ASCII en boules et obstacles (coordonnees logiques). */
export function expandLayout(
  layout: LayoutDef,
  board: Pick<BoardDef, 'width' | 'ballRadius'>,
  levelId: string,
): { balls: BallDef[]; obstacles: ObstacleDef[] } {
  const r = board.ballRadius;
  const cell = layout.cell ?? r * 2;
  const packing = layout.packing ?? 'hex';
  const rowStep = packing === 'hex' ? cell * (Math.sqrt(3) / 2) : cell;
  const originY = layout.originY ?? r;
  const longest = layout.rows.reduce((m, row) => Math.max(m, row.length), 0);
  // En "hex", les rangees impaires debordent d'une demi-cellule : on centre l'ensemble.
  const totalWidth = packing === 'hex' && layout.rows.length > 1 ? longest * cell + cell / 2 : longest * cell;
  const originX = layout.originX ?? (board.width - totalWidth) / 2 + cell / 2;
  // Hauteur d'une case d'obstacle : en "hex" les rangees sont plus serrees que
  // la cellule, une case pleine chevaucherait les boules des rangees voisines.
  // 2*rowStep - cell rend les boules voisines exactement tangentes a la case.
  const blockH = 2 * rowStep - cell;

  const balls: BallDef[] = [];
  const obstacles: ObstacleDef[] = [];

  layout.rows.forEach((row, i) => {
    const y = originY + i * rowStep;
    const shift = packing === 'hex' && i % 2 === 1 ? cell / 2 : 0;
    let runStart = -1;
    const flushRun = (endExclusive: number) => {
      if (runStart < 0) return;
      const x0 = originX + shift + runStart * cell - cell / 2;
      obstacles.push({
        type: 'block',
        x: round2(x0),
        y: round2(y - blockH / 2),
        w: round2((endExclusive - runStart) * cell),
        h: round2(blockH),
      });
      runStart = -1;
    };
    for (let j = 0; j < row.length; j++) {
      const ch = row[j] as string;
      const meaning = ch === ' ' ? '' : layout.legend[ch];
      if (meaning === undefined) {
        throw new LevelError(`caractere inconnu « ${ch} » (rangee ${i}, colonne ${j}) : absent de la legende`, levelId);
      }
      if (meaning === 'block') {
        if (runStart < 0) runStart = j;
        continue;
      }
      flushRun(j);
      if (meaning === '') continue;
      balls.push({ x: round2(originX + shift + j * cell), y: round2(y), color: meaning });
    }
    flushRun(row.length);
  });

  return { balls, obstacles };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Complete un niveau source avec les defauts et le valide. */
export function loadLevel(source: LevelSource): LevelDef {
  if (!source || typeof source.id !== 'string' || source.id.length === 0) {
    throw new LevelError('id manquant', String(source?.id ?? '?'));
  }
  const id = source.id;
  const width = source.board?.width ?? DEFAULT_BOARD_WIDTH;
  const height = source.board?.height ?? DEFAULT_BOARD_HEIGHT;
  const ballRadius = source.board?.ballRadius ?? DEFAULT_BALL_RADIUS;

  const board: BoardDef = {
    width,
    height,
    ballRadius,
    floorY: source.board?.floorY ?? Math.round(height * 0.8),
    walls: { left: true, right: true, top: true, ...source.board?.walls },
    anchors: { top: true, left: false, right: false, obstacles: true, ...source.board?.anchors },
    contactTolerance: source.board?.contactTolerance ?? 0.12,
  };

  const cannon = {
    x: width / 2,
    y: Math.round(height * 0.92),
    minX: ballRadius * 2.5,
    maxX: width - ballRadius * 2.5,
    movable: true,
    minAngleDeg: 8,
    ...source.cannon,
  };

  const physics = {
    speed: 2400,
    gravity: 0,
    maxBounces: 12,
    settle: 'land' as const,
    dt: 1 / 120,
    maxFlightTime: 6,
    ...source.physics,
  };

  const colors = source.colors ?? ['ruby', 'sapphire', 'emerald'];
  const colorSequence = {
    sequence: colors.slice(),
    intervalMs: 4000,
    warningMs: 900,
    startIndex: 0,
    pauseDuringFlight: false,
    ...source.colorSequence,
  };

  let balls: BallDef[] = source.balls ? source.balls.map((b) => ({ ...b })) : [];
  let obstacles: ObstacleDef[] = source.obstacles ? source.obstacles.map((o) => ({ type: 'block', ...o })) : [];
  if (source.layout) {
    const expanded = expandLayout(source.layout, board, id);
    balls = balls.concat(expanded.balls);
    obstacles = obstacles.concat(expanded.obstacles);
  }

  const level: LevelDef = {
    id,
    index: source.index ?? 0,
    name: source.name ?? id,
    board,
    cannon,
    physics,
    colors,
    colorSequence,
    balls,
    obstacles,
    photo: { fit: 'cover', focusX: 0.5, focusY: 0.4, scale: 1, ...source.photo },
    reveal: { radiusFactor: 1.7, softness: 0.55, shape: 'circle', ...source.reveal },
    trophies: { metric: 'shots', gold: 10, silver: 15, bronze: 25, ...source.trophies },
    difficulty: { predictionBounces: -1, ...source.difficulty },
  };

  validateLevel(level);
  return level;
}

/** Verifie la coherence d'un niveau normalise ; leve LevelError sinon. */
export function validateLevel(level: LevelDef): void {
  const { board, cannon, colorSequence, trophies } = level;
  const fail = (msg: string): never => {
    throw new LevelError(msg, level.id);
  };
  if (board.width <= 0 || board.height <= 0) fail('dimensions du plateau invalides');
  if (board.ballRadius <= 0) fail('rayon de boule invalide');
  if (board.floorY <= 0 || board.floorY >= board.height) fail('floorY doit etre entre 0 et height');
  if (cannon.minX > cannon.maxX) fail('cannon.minX > cannon.maxX');
  if (cannon.x < cannon.minX || cannon.x > cannon.maxX) fail('cannon.x hors de [minX, maxX]');
  if (level.colors.length < 2) fail('il faut au moins deux couleurs');
  if (colorSequence.sequence.length === 0) fail('sequence de couleurs vide');
  for (const c of colorSequence.sequence) {
    if (!level.colors.includes(c)) fail(`la sequence utilise une couleur absente du niveau : ${c}`);
  }
  if (colorSequence.intervalMs <= 0) fail('intervalMs doit etre > 0');
  if (colorSequence.warningMs < 0 || colorSequence.warningMs >= colorSequence.intervalMs) {
    fail('warningMs doit etre entre 0 et intervalMs');
  }
  if (!(trophies.gold <= trophies.silver && trophies.silver <= trophies.bronze)) {
    fail('seuils de trophees incoherents (gold <= silver <= bronze attendu)');
  }
  if (level.balls.length === 0) fail('aucune boule');
  const r = board.ballRadius;
  level.balls.forEach((b, i) => {
    if (!level.colors.includes(b.color)) fail(`boule ${i} : couleur inconnue ${b.color}`);
    if (b.x < r - 0.01 || b.x > board.width - r + 0.01 || b.y < r - 0.01 || b.y > board.floorY) {
      fail(`boule ${i} hors du plateau (${b.x}, ${b.y})`);
    }
  });
  // Deux boules ne doivent pas se chevaucher (tolerance d'un dixieme de rayon).
  for (let i = 0; i < level.balls.length; i++) {
    for (let j = i + 1; j < level.balls.length; j++) {
      const a = level.balls[i]!;
      const b = level.balls[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 2 * r - r * 0.1) fail(`boules ${i} et ${j} se chevauchent (distance ${d.toFixed(1)})`);
    }
  }
  level.obstacles.forEach((o, i) => {
    if (o.w <= 0 || o.h <= 0) fail(`obstacle ${i} : dimensions invalides`);
  });
}

/** Petit utilitaire partage : liste des couleurs distinctes reellement presentes. */
export function colorsInUse(level: LevelDef): ColorId[] {
  return Array.from(new Set(level.balls.map((b) => b.color)));
}
