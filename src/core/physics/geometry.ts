/**
 * Geometrie de balayage (continuous collision) pour un cercle en mouvement
 * rectiligne pendant un petit pas de temps. Toutes les fonctions sont pures.
 *
 * Convention : le mobile part de (px, py), avance de (dx, dy) pendant le pas ;
 * on renvoie t dans [0, 1] (fraction du pas) du premier contact, ou -1 s'il n'y
 * en a pas. La normale renvoyee pointe vers le mobile (pour le rebond).
 */

export interface SweepHit {
  t: number;
  nx: number;
  ny: number;
}

const EPS = 1e-9;

/** Premier instant ou un point (px,py) + t*(dx,dy) entre dans le cercle (cx, cy, radius). */
export function sweepPointCircle(
  px: number,
  py: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  radius: number,
): number {
  const fx = px - cx;
  const fy = py - cy;
  const a = dx * dx + dy * dy;
  if (a < EPS) return -1;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  if (c < 0) {
    // Deja a l'interieur : contact immediat seulement si on s'enfonce.
    return b < 0 ? 0 : -1;
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  const t = (-b - sq) / (2 * a);
  if (t < 0 || t > 1) return -1;
  return t;
}

/**
 * Balayage d'un cercle de rayon r contre un rectangle (somme de Minkowski :
 * rectangle elargi de r, coins arrondis). Renvoie le premier contact.
 */
export function sweepCircleRect(
  px: number,
  py: number,
  dx: number,
  dy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): SweepHit | null {
  const best: { hit: SweepHit | null } = { hit: null };
  const consider = (t: number, nx: number, ny: number) => {
    if (t < 0 || t > 1) return;
    if (best.hit === null || t < best.hit.t) best.hit = { t, nx, ny };
  };

  // Faces verticales (gauche/droite du rectangle elargi), valides entre ry et ry+rh.
  if (Math.abs(dx) > EPS) {
    const tl = (rx - r - px) / dx;
    if (dx > 0) {
      const y = py + tl * dy;
      if (y >= ry && y <= ry + rh) consider(tl, -1, 0);
    }
    const tr = (rx + rw + r - px) / dx;
    if (dx < 0) {
      const y = py + tr * dy;
      if (y >= ry && y <= ry + rh) consider(tr, 1, 0);
    }
  }
  // Faces horizontales.
  if (Math.abs(dy) > EPS) {
    const tt = (ry - r - py) / dy;
    if (dy > 0) {
      const x = px + tt * dx;
      if (x >= rx && x <= rx + rw) consider(tt, 0, -1);
    }
    const tb = (ry + rh + r - py) / dy;
    if (dy < 0) {
      const x = px + tb * dx;
      if (x >= rx && x <= rx + rw) consider(tb, 0, 1);
    }
  }
  // Coins arrondis.
  const corners = [
    [rx, ry],
    [rx + rw, ry],
    [rx, ry + rh],
    [rx + rw, ry + rh],
  ] as const;
  for (const [cx, cy] of corners) {
    const t = sweepPointCircle(px, py, dx, dy, cx, cy, r);
    if (t >= 0) {
      const hx = px + t * dx - cx;
      const hy = py + t * dy - cy;
      const len = Math.hypot(hx, hy) || 1;
      consider(t, hx / len, hy / len);
    }
  }
  return best.hit;
}

/** Reflexion d'un vecteur vitesse sur une normale unitaire. */
export function reflect(vx: number, vy: number, nx: number, ny: number): [number, number] {
  const dot = vx * nx + vy * ny;
  return [vx - 2 * dot * nx, vy - 2 * dot * ny];
}

/** Distance entre un point et un rectangle (0 si le point est dedans). */
export function pointRectDistance(px: number, py: number, rx: number, ry: number, rw: number, rh: number): number {
  const cx = Math.max(rx, Math.min(px, rx + rw));
  const cy = Math.max(ry, Math.min(py, ry + rh));
  return Math.hypot(px - cx, py - cy);
}
