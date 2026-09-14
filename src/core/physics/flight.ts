/**
 * Simulation du vol d'une boule tiree : ligne droite (ou parabole si gravite),
 * rebonds exacts sur les bords et les obstacles, arret au premier contact avec
 * une boule posee ou une ancre.
 *
 * DETERMINISME : pas de temps fixe, aucune source d'aleatoire, contacts
 * calcules analytiquement dans chaque pas (pas de tunnel possible). La ligne de
 * visee et le vol reel appellent exactement cette fonction : ce que le joueur
 * voit avant de tirer est ce qui se passe.
 */
import { reflect, sweepCircleRect, sweepPointCircle } from './geometry';

export interface FlightBall {
  id: number;
  x: number;
  y: number;
}

export interface FlightObstacle {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ce que la simulation a besoin de connaitre du plateau. */
export interface FlightWorld {
  width: number;
  height: number;
  floorY: number;
  radius: number;
  walls: { left: boolean; right: boolean; top: boolean };
  anchors: { top: boolean; left: boolean; right: boolean };
  balls: ReadonlyArray<FlightBall>;
  obstacles: ReadonlyArray<FlightObstacle>;
}

export interface FlightParams {
  speed: number;
  gravity: number;
  maxBounces: number;
  dt: number;
  maxFlightTime: number;
}

export type FlightSurface = 'wall-left' | 'wall-right' | 'wall-top' | 'obstacle' | 'ball' | 'floor' | 'timeout';

export interface FlightEvent {
  /** Temps absolu depuis le tir (s). */
  t: number;
  type: 'bounce' | 'attach' | 'lost';
  x: number;
  y: number;
  surface: FlightSurface;
  /** Normale de contact (vers la boule), pour l'effet d'impact. */
  nx: number;
  ny: number;
  /** Boule ou obstacle touche. */
  targetId?: number;
}

export interface FlightResult {
  /** Positions du centre a chaque pas (index 0 = depart). */
  xs: number[];
  ys: number[];
  dt: number;
  /** Duree totale du vol (s). */
  duration: number;
  events: FlightEvent[];
  outcome: 'attached' | 'lost';
  endX: number;
  endY: number;
  /** Renseigne si outcome === 'attached'. */
  attachSurface?: 'ball' | 'wall-top' | 'wall-left' | 'wall-right';
  attachTargetId?: number;
}

interface Candidate {
  t: number;
  nx: number;
  ny: number;
  surface: FlightSurface;
  targetId?: number;
  kind: 'bounce' | 'attach' | 'lost';
}

const CONTACT_PUSH = 1e-4;

export function simulateFlight(
  world: FlightWorld,
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
  params: FlightParams,
): FlightResult {
  const r = world.radius;
  const dt = params.dt;
  const len = Math.hypot(dirX, dirY) || 1;
  let vx = (dirX / len) * params.speed;
  let vy = (dirY / len) * params.speed;
  let x = startX;
  let y = startY;
  let time = 0;
  let bounces = 0;

  const xs: number[] = [x];
  const ys: number[] = [y];
  const events: FlightEvent[] = [];
  let outcome: 'attached' | 'lost' | null = null;
  let attachSurface: FlightResult['attachSurface'];
  let attachTargetId: number | undefined;

  const maxSteps = Math.ceil(params.maxFlightTime / dt);
  const diameter = 2 * r;

  for (let step = 0; step < maxSteps && outcome === null; step++) {
    if (params.gravity !== 0) vy += params.gravity * dt;
    let remain = 1;
    let guard = 0;
    while (remain > 0 && guard++ < 8 && outcome === null) {
      const dx = vx * dt * remain;
      const dy = vy * dt * remain;
      // Conteneur (et non une variable) : TypeScript ne suit pas les affectations faites dans une fermeture.
      const best: { c: Candidate | null } = { c: null };
      const consider = (c: Candidate) => {
        if (c.t < 0 || c.t > 1) return;
        if (best.c === null || c.t < best.c.t) best.c = c;
      };

      // Bords.
      if (dx < 0) {
        const t = (r - x) / dx;
        consider({
          t,
          nx: 1,
          ny: 0,
          surface: 'wall-left',
          kind: world.anchors.left ? 'attach' : world.walls.left ? 'bounce' : 'lost',
        });
      } else if (dx > 0) {
        const t = (world.width - r - x) / dx;
        consider({
          t,
          nx: -1,
          ny: 0,
          surface: 'wall-right',
          kind: world.anchors.right ? 'attach' : world.walls.right ? 'bounce' : 'lost',
        });
      }
      if (dy < 0) {
        const t = (r - y) / dy;
        consider({
          t,
          nx: 0,
          ny: 1,
          surface: 'wall-top',
          kind: world.anchors.top ? 'attach' : world.walls.top ? 'bounce' : 'lost',
        });
      } else if (dy > 0) {
        // Redescente sous la ligne de chute (ou sortie par le bas) : la boule est perdue.
        const limit = y < world.floorY + r ? world.floorY + r : world.height + r;
        const t = (limit - y) / dy;
        consider({ t, nx: 0, ny: -1, surface: 'floor', kind: 'lost' });
      }

      // Obstacles (rebond).
      for (const o of world.obstacles) {
        const hit = sweepCircleRect(x, y, dx, dy, r, o.x, o.y, o.w, o.h);
        if (hit) consider({ t: hit.t, nx: hit.nx, ny: hit.ny, surface: 'obstacle', kind: 'bounce', targetId: o.id });
      }

      // Boules posees (contact = arret).
      for (const b of world.balls) {
        const t = sweepPointCircle(x, y, dx, dy, b.x, b.y, diameter);
        if (t >= 0) {
          const hx = x + t * dx - b.x;
          const hy = y + t * dy - b.y;
          const hl = Math.hypot(hx, hy) || 1;
          consider({ t, nx: hx / hl, ny: hy / hl, surface: 'ball', kind: 'attach', targetId: b.id });
        }
      }

      const hit = best.c;
      if (hit === null) {
        x += dx;
        y += dy;
        remain = 0;
        continue;
      }
      x += hit.t * dx;
      y += hit.t * dy;
      const eventTime = time + (1 - remain + hit.t * remain) * dt;
      remain *= 1 - hit.t;

      if (hit.kind === 'attach') {
        if (hit.surface === 'wall-top') y = r;
        if (hit.surface === 'wall-left') x = r;
        if (hit.surface === 'wall-right') x = world.width - r;
        outcome = 'attached';
        attachSurface = hit.surface as FlightResult['attachSurface'];
        attachTargetId = hit.targetId;
        events.push({ t: eventTime, type: 'attach', x, y, surface: hit.surface, nx: hit.nx, ny: hit.ny, targetId: hit.targetId });
      } else if (hit.kind === 'lost') {
        outcome = 'lost';
        events.push({ t: eventTime, type: 'lost', x, y, surface: hit.surface, nx: hit.nx, ny: hit.ny });
      } else {
        bounces++;
        [vx, vy] = reflect(vx, vy, hit.nx, hit.ny);
        // Petit decollement pour ne jamais reconsiderer la meme surface au pas suivant.
        x += hit.nx * CONTACT_PUSH;
        y += hit.ny * CONTACT_PUSH;
        events.push({ t: eventTime, type: 'bounce', x, y, surface: hit.surface, nx: hit.nx, ny: hit.ny, targetId: hit.targetId });
        if (bounces > params.maxBounces) {
          outcome = 'lost';
          events.push({ t: eventTime, type: 'lost', x, y, surface: 'timeout', nx: 0, ny: 0 });
        }
      }
    }
    time += dt;
    xs.push(x);
    ys.push(y);
  }

  if (outcome === null) {
    outcome = 'lost';
    events.push({ t: time, type: 'lost', x, y, surface: 'timeout', nx: 0, ny: 0 });
  }

  // La derniere position enregistree doit etre exactement celle de l'arret.
  const last = events[events.length - 1];
  if (last && (last.type === 'attach' || last.type === 'lost')) {
    xs[xs.length - 1] = last.x;
    ys[ys.length - 1] = last.y;
  }

  const duration = last ? last.t : time;
  const result: FlightResult = {
    xs,
    ys,
    dt,
    duration,
    events,
    outcome,
    endX: x,
    endY: y,
  };
  if (attachSurface !== undefined) result.attachSurface = attachSurface;
  if (attachTargetId !== undefined) result.attachTargetId = attachTargetId;
  return result;
}

/** Position interpolee du centre a l'instant t (s) d'un vol simule. */
export function flightPositionAt(flight: FlightResult, t: number): { x: number; y: number } {
  if (t <= 0) return { x: flight.xs[0]!, y: flight.ys[0]! };
  const last = flight.xs.length - 1;
  if (t >= flight.duration) return { x: flight.endX, y: flight.endY };
  const f = t / flight.dt;
  const i = Math.min(last - 1, Math.floor(f));
  const a = f - i;
  return {
    x: flight.xs[i]! + (flight.xs[i + 1]! - flight.xs[i]!) * a,
    y: flight.ys[i]! + (flight.ys[i + 1]! - flight.ys[i]!) * a,
  };
}

/**
 * Points de la ligne de visee : depart, chaque rebond, arrivee. La ligne est
 * tronquee apres `maxBounces` rebonds si la difficulte le demande.
 */
export function flightPolyline(flight: FlightResult, maxBounces = -1): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [{ x: flight.xs[0]!, y: flight.ys[0]! }];
  let bounces = 0;
  for (const e of flight.events) {
    if (e.type === 'bounce') {
      bounces++;
      pts.push({ x: e.x, y: e.y });
      if (maxBounces >= 0 && bounces >= maxBounces) return pts;
    } else {
      pts.push({ x: e.x, y: e.y });
      break;
    }
  }
  return pts;
}
