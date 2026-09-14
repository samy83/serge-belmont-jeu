/**
 * Le plateau : les boules posees, les obstacles, et les relations de contact.
 *
 * Deux boules sont "en contact" quand la distance entre leurs centres est au
 * plus 2r + tolerance. Les groupes de couleur et le soutien (ce qui tient ou
 * tombe) se calculent sur ce graphe de contacts. Aucune grille : les positions
 * sont libres, ce sont les contacts qui font la structure.
 */
import type { Ball, BallDef, BoardDef, ColorId, Obstacle, ObstacleDef, Vec2 } from '../model/types';
import { pointRectDistance } from '../physics/geometry';

export class Board {
  readonly def: BoardDef;
  readonly obstacles: Obstacle[] = [];
  private readonly balls = new Map<number, Ball>();
  private nextId = 1;

  constructor(def: BoardDef, balls: BallDef[] = [], obstacles: ObstacleDef[] = []) {
    this.def = def;
    obstacles.forEach((o, i) => this.obstacles.push({ id: i + 1, type: o.type ?? 'block', x: o.x, y: o.y, w: o.w, h: o.h }));
    for (const b of balls) this.addBall(b.x, b.y, b.color, b.anchored);
  }

  get radius(): number {
    return this.def.ballRadius;
  }

  /** Distance maximale entre centres pour qu'il y ait contact. */
  get contactDistance(): number {
    return this.radius * (2 + this.def.contactTolerance);
  }

  get count(): number {
    return this.balls.size;
  }

  all(): Ball[] {
    return Array.from(this.balls.values());
  }

  get(id: number): Ball | undefined {
    return this.balls.get(id);
  }

  has(id: number): boolean {
    return this.balls.has(id);
  }

  addBall(x: number, y: number, color: ColorId, anchored = false): Ball {
    const ball: Ball = { id: this.nextId++, x, y, color };
    if (anchored) ball.anchored = true;
    this.balls.set(ball.id, ball);
    return ball;
  }

  remove(ids: Iterable<number>): void {
    for (const id of ids) this.balls.delete(id);
  }

  move(ids: Iterable<number>, dx: number, dy: number): void {
    for (const id of ids) {
      const b = this.balls.get(id);
      if (b) {
        b.x += dx;
        b.y += dy;
      }
    }
  }

  /** Boules en contact avec la boule donnee (hors elle-meme). */
  neighbors(ball: Ball): Ball[] {
    const out: Ball[] = [];
    const maxD = this.contactDistance;
    for (const other of this.balls.values()) {
      if (other.id === ball.id) continue;
      if (Math.hypot(other.x - ball.x, other.y - ball.y) <= maxD) out.push(other);
    }
    return out;
  }

  /** Une boule touche-t-elle directement une ancre (plafond, bords, obstacle) ? */
  touchesAnchor(ball: Ball): boolean {
    if (ball.anchored) return true;
    const r = this.radius;
    const tol = r * this.def.contactTolerance;
    const a = this.def.anchors;
    if (a.top && ball.y - r <= tol) return true;
    if (a.left && ball.x - r <= tol) return true;
    if (a.right && this.def.width - (ball.x + r) <= tol) return true;
    if (a.obstacles) {
      for (const o of this.obstacles) {
        if (pointRectDistance(ball.x, ball.y, o.x, o.y, o.w, o.h) <= r + tol) return true;
      }
    }
    return false;
  }

  /** Ensemble des boules qui tiennent (ancrees ou reliees a une ancre par contacts). */
  supported(): Set<number> {
    const supported = new Set<number>();
    const stack: Ball[] = [];
    for (const b of this.balls.values()) {
      if (this.touchesAnchor(b)) {
        supported.add(b.id);
        stack.push(b);
      }
    }
    while (stack.length > 0) {
      const b = stack.pop()!;
      for (const n of this.neighbors(b)) {
        if (!supported.has(n.id)) {
          supported.add(n.id);
          stack.push(n);
        }
      }
    }
    return supported;
  }

  /** Groupe connexe (par contact) de meme couleur contenant la boule donnee. */
  colorGroup(startId: number): number[] {
    const start = this.balls.get(startId);
    if (!start) return [];
    const seen = new Set<number>([startId]);
    const stack = [start];
    while (stack.length > 0) {
      const b = stack.pop()!;
      for (const n of this.neighbors(b)) {
        if (n.color === b.color && !seen.has(n.id)) {
          seen.add(n.id);
          stack.push(n);
        }
      }
    }
    return Array.from(seen);
  }

  /** Tous les groupes de meme couleur d'au moins `minSize` boules. */
  matchGroups(minSize = 3): number[][] {
    const seen = new Set<number>();
    const groups: number[][] = [];
    for (const b of this.balls.values()) {
      if (seen.has(b.id)) continue;
      const g = this.colorGroup(b.id);
      g.forEach((id) => seen.add(id));
      if (g.length >= minSize) groups.push(g);
    }
    return groups;
  }

  /** Decoupe un ensemble de boules en composantes connexes (par contact). */
  clusters(ids: Iterable<number>): number[][] {
    const pool = new Set(ids);
    const out: number[][] = [];
    while (pool.size > 0) {
      const first = pool.values().next().value as number;
      pool.delete(first);
      const comp = [first];
      const stack = [this.balls.get(first)!];
      while (stack.length > 0) {
        const b = stack.pop()!;
        for (const n of this.neighbors(b)) {
          if (pool.has(n.id)) {
            pool.delete(n.id);
            comp.push(n.id);
            stack.push(n);
          }
        }
      }
      out.push(comp);
    }
    return out;
  }

  /** Le point (x,y) est-il libre pour poser une boule (aucun chevauchement) ? */
  isFree(x: number, y: number, ignoreId = -1): boolean {
    const r = this.radius;
    const minD = 2 * r - r * 0.02;
    for (const b of this.balls.values()) {
      if (b.id === ignoreId) continue;
      if (Math.hypot(b.x - x, b.y - y) < minD) return false;
    }
    for (const o of this.obstacles) {
      if (pointRectDistance(x, y, o.x, o.y, o.w, o.h) < r - r * 0.02) return false;
    }
    if (x < r - 0.01 || x > this.def.width - r + 0.01 || y < r - 0.01) return false;
    return true;
  }

  /**
   * Calcule la position finale d'une boule qui vient de se poser en (x, y) :
   * si une deuxieme boule est presque touchee, on "blottit" la boule pour
   * qu'elle touche exactement les deux (structure plus reguliere, contact
   * visuel satisfaisant). Sinon la position ne change pas.
   */
  nestle(x: number, y: number, contactId?: number): Vec2 {
    const r = this.radius;
    const d = 2 * r;
    const snapRange = d + r * 0.6;
    const anchor = contactId !== undefined ? this.balls.get(contactId) : undefined;
    if (!anchor) return { x, y };
    let best: Vec2 | null = null;
    let bestDist = Infinity;
    for (const other of this.balls.values()) {
      if (other.id === anchor.id) continue;
      const dist = Math.hypot(other.x - x, other.y - y);
      if (dist > snapRange || dist < d - r * 0.05) continue;
      for (const p of circleCircleIntersections(anchor.x, anchor.y, d, other.x, other.y, d)) {
        const moved = Math.hypot(p.x - x, p.y - y);
        if (moved < bestDist && moved <= r * 0.6 && this.isFree(p.x, p.y)) {
          best = p;
          bestDist = moved;
        }
      }
    }
    return best ?? { x, y };
  }
}

/** Intersections de deux cercles (0, 1 ou 2 points). */
export function circleCircleIntersections(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
): Vec2[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-9 || dist > r1 + r2 || dist < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + dist * dist) / (2 * dist);
  const h2 = r1 * r1 - a * a;
  const h = h2 > 0 ? Math.sqrt(h2) : 0;
  const mx = x1 + (a * dx) / dist;
  const my = y1 + (a * dy) / dist;
  if (h === 0) return [{ x: mx, y: my }];
  return [
    { x: mx + (h * dy) / dist, y: my - (h * dx) / dist },
    { x: mx - (h * dy) / dist, y: my + (h * dx) / dist },
  ];
}
