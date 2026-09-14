/**
 * Resolution d'un plateau apres qu'une boule s'est posee : explosion des
 * groupes de 3+, chute des boules qui ne tiennent plus, atterrissage, nouvelles
 * explosions... jusqu'a ce que tout soit stable.
 *
 * Le plateau est modifie jusqu'a son etat final ; la liste d'etapes renvoyee
 * decrit, dans l'ordre, ce que le rendu doit jouer. Tout est deterministe.
 */
import type { Board } from './board';
import type { ColorId, PhysicsDef } from '../model/types';

export interface FallCluster {
  ballIds: number[];
  /** Distance verticale parcourue (unites logiques). */
  distance: number;
  /** true : s'est pose sur quelque chose qui tient ; false : a quitte le niveau. */
  landed: boolean;
}

export type ResolutionStep =
  | { type: 'match'; chain: number; ballIds: number[]; color: ColorId; centerX: number; centerY: number }
  | { type: 'fall'; chain: number; clusters: FallCluster[] };

export interface ResolutionSummary {
  steps: ResolutionStep[];
  /** Boules detruites par explosion. */
  matched: number;
  /** Boules parties par chute. */
  dropped: number;
  /** Nombre d'explosions en cascade (0 si aucune explosion). */
  chainLength: number;
  /** Nombre total d'explosions (y compris la premiere). */
  matches: number;
}

const MIN_GROUP = 3;

/** Resout le plateau apres la pose de `ballId` (ou tout le plateau si absent). */
export function resolveBoard(board: Board, physics: Pick<PhysicsDef, 'settle'>, landedBallId?: number): ResolutionSummary {
  const steps: ResolutionStep[] = [];
  let matched = 0;
  let dropped = 0;
  let matches = 0;
  let chain = 0;

  let groups: number[][];
  if (landedBallId !== undefined) {
    const g = board.colorGroup(landedBallId);
    groups = g.length >= MIN_GROUP ? [g] : [];
  } else {
    groups = board.matchGroups(MIN_GROUP);
  }

  while (groups.length > 0) {
    for (const g of groups) {
      steps.push(matchStep(board, g, chain));
      board.remove(g);
      matched += g.length;
      matches++;
    }
    const falls = settle(board, physics.settle);
    if (falls.length > 0) {
      steps.push({ type: 'fall', chain, clusters: falls });
      for (const c of falls) if (!c.landed) dropped += c.ballIds.length;
    }
    chain++;
    groups = board.matchGroups(MIN_GROUP);
  }

  return { steps, matched, dropped, chainLength: Math.max(0, chain - 1), matches };
}

function matchStep(board: Board, ids: number[], chain: number): ResolutionStep {
  let cx = 0;
  let cy = 0;
  let color: ColorId = '';
  for (const id of ids) {
    const b = board.get(id)!;
    cx += b.x;
    cy += b.y;
    color = b.color;
  }
  return { type: 'match', chain, ballIds: ids.slice(), color, centerX: cx / ids.length, centerY: cy / ids.length };
}

/**
 * Fait tomber tout ce qui ne tient plus. Toutes les grappes tombent ensemble a
 * la meme vitesse ; celle qui touche en premier quelque chose qui tient s'y
 * pose et devient un appui pour les suivantes. Une grappe qui atteint la ligne
 * de chute quitte le niveau.
 */
export function settle(board: Board, mode: PhysicsDef['settle']): FallCluster[] {
  const supported = board.supported();
  const loose = board.all().filter((b) => !supported.has(b.id)).map((b) => b.id);
  if (loose.length === 0) return [];

  const clusters = board.clusters(loose).map((ids) => ({ ids, fallen: 0, done: false, landed: false }));
  const floorY = board.def.floorY;

  if (mode === 'drop') {
    for (const c of clusters) {
      let maxY = -Infinity;
      for (const id of c.ids) maxY = Math.max(maxY, board.get(id)!.y);
      c.fallen = Math.max(0, floorY - maxY);
      board.remove(c.ids);
    }
    return clusters.map((c) => ({ ballIds: c.ids, distance: c.fallen, landed: false }));
  }

  let guard = 0;
  while (clusters.some((c) => !c.done) && guard++ < 1000) {
    let bestIndex = -1;
    let bestD = Infinity;
    let bestLands = false;
    clusters.forEach((c, i) => {
      if (c.done) return;
      const { d, lands } = dropDistance(board, c.ids, supported);
      if (d < bestD) {
        bestD = d;
        bestLands = lands;
        bestIndex = i;
      }
    });
    if (bestIndex < 0) break;
    const d = Math.max(0, bestD);
    if (d > 0) {
      for (const c of clusters) {
        if (c.done) continue;
        board.move(c.ids, 0, d);
        c.fallen += d;
      }
    }
    const chosen = clusters[bestIndex]!;
    chosen.done = true;
    if (bestLands) {
      chosen.landed = true;
      for (const id of chosen.ids) supported.add(id);
    } else {
      board.remove(chosen.ids);
    }
  }

  return clusters.map((c) => ({ ballIds: c.ids, distance: round(c.fallen), landed: c.landed }));
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Distance de chute d'une grappe rigide avant de toucher un appui ou la ligne de chute. */
function dropDistance(board: Board, ids: number[], supported: Set<number>): { d: number; lands: boolean } {
  const r = board.radius;
  const tol = r * board.def.contactTolerance;
  const twoR = 2 * r;
  const floorY = board.def.floorY;
  const supportedBalls = board.all().filter((b) => supported.has(b.id));

  let dFloor = Infinity;
  let dLand = Infinity;
  for (const id of ids) {
    const a = board.get(id)!;
    dFloor = Math.min(dFloor, floorY - a.y);
    for (const b of supportedBalls) {
      const dx = Math.abs(a.x - b.x);
      if (dx >= twoR) continue;
      const dy = b.y - Math.sqrt(twoR * twoR - dx * dx) - a.y;
      if (dy >= -tol) dLand = Math.min(dLand, Math.max(0, dy));
    }
    if (board.def.anchors.obstacles) {
      for (const o of board.obstacles) {
        let contactY: number | null = null;
        if (a.x >= o.x && a.x <= o.x + o.w) {
          contactY = o.y - r;
        } else {
          const cx = a.x < o.x ? o.x : o.x + o.w;
          const dx = Math.abs(a.x - cx);
          if (dx < r) contactY = o.y - Math.sqrt(r * r - dx * dx);
        }
        if (contactY !== null) {
          const dy = contactY - a.y;
          if (dy >= -tol) dLand = Math.min(dLand, Math.max(0, dy));
        }
      }
    }
  }
  if (dLand < dFloor) return { d: dLand, lands: true };
  return { d: Math.max(0, dFloor), lands: false };
}
