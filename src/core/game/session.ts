/**
 * Une partie sur un niveau : le plateau, le canon, la couleur qui defile, les
 * tirs et leurs consequences. Aucune notion de temps reel ici : la couche de
 * rendu appelle `update(dtMs)` et joue les resultats de `fire()`.
 */
import { Board } from '../board/board';
import { resolveBoard, type ResolutionSummary } from '../board/resolve';
import type { ColorId, LevelDef, Vec2 } from '../model/types';
import { simulateFlight, type FlightResult, type FlightWorld } from '../physics/flight';
import { ColorSequencer } from '../rules/colorSequencer';
import { evaluateTrophy, type LevelResult } from '../rules/trophies';
import type { TrophyTier } from '../model/types';

export interface ShotResult {
  /** Numero du tir (1 = premier). */
  shotIndex: number;
  color: ColorId;
  flight: FlightResult;
  /** Renseignes si la boule s'est posee. */
  ballId?: number;
  /** Position de contact, puis position finale apres blottissement. */
  attachFrom?: Vec2;
  attachTo?: Vec2;
  /** Boules en contact avec la boule posee, AVANT la resolution (pour l'animation de contact). */
  contacts: Array<{ id: number; x: number; y: number }>;
  resolution: ResolutionSummary;
  /** Le niveau est-il termine apres ce tir ? */
  won: boolean;
}

export type SessionState = 'playing' | 'won';

export class GameSession {
  readonly level: LevelDef;
  readonly board: Board;
  readonly sequencer: ColorSequencer;
  state: SessionState = 'playing';
  shots = 0;
  timeMs = 0;
  matches = 0;
  maxChain = 0;
  ballsMatched = 0;
  ballsDropped = 0;
  private cannonXValue: number;

  constructor(level: LevelDef) {
    this.level = level;
    this.board = new Board(level.board, level.balls, level.obstacles);
    this.sequencer = new ColorSequencer(level.colorSequence);
    this.cannonXValue = level.cannon.x;
  }

  get cannonX(): number {
    return this.cannonXValue;
  }

  get cannonY(): number {
    return this.level.cannon.y;
  }

  /** Couleur actuellement chargee dans le canon. */
  get currentColor(): ColorId {
    return this.sequencer.current;
  }

  /** Avance le temps de jeu. `busy` = une boule vole ou une reaction se joue. */
  update(dtMs: number, busy = false): void {
    if (this.state !== 'playing') return;
    this.timeMs += dtMs;
    if (busy && this.level.colorSequence.pauseDuringFlight) return;
    this.sequencer.update(dtMs);
  }

  setCannonX(x: number): void {
    const c = this.level.cannon;
    if (!c.movable) return;
    this.cannonXValue = Math.max(c.minX, Math.min(c.maxX, x));
  }

  /**
   * Direction de tir vers un point (doigt), contrainte a l'angle minimal.
   * Renvoie null si le point est sous le canon (pas de tir vers le bas).
   */
  aimDirection(px: number, py: number): Vec2 | null {
    const dx = px - this.cannonXValue;
    const dy = py - this.level.cannon.y;
    if (dy >= 0 && Math.abs(dx) < 1e-6) return null;
    const minAngle = (this.level.cannon.minAngleDeg * Math.PI) / 180;
    let angle = Math.atan2(-dy, dx); // 0 = droite, PI/2 = haut
    if (angle < 0) {
      // Sous l'horizontale : on ramene au bord le plus proche.
      angle = dx >= 0 ? minAngle : Math.PI - minAngle;
    }
    angle = Math.max(minAngle, Math.min(Math.PI - minAngle, angle));
    return { x: Math.cos(angle), y: -Math.sin(angle) };
  }

  flightWorld(): FlightWorld {
    const b = this.level.board;
    return {
      width: b.width,
      height: b.height,
      floorY: b.floorY,
      radius: b.ballRadius,
      walls: b.walls,
      anchors: b.anchors,
      balls: this.board.all(),
      obstacles: this.board.obstacles,
    };
  }

  /** Simule le vol sans tirer (ligne de visee). */
  predict(dir: Vec2): FlightResult {
    return simulateFlight(this.flightWorld(), this.cannonXValue, this.level.cannon.y, dir.x, dir.y, this.level.physics);
  }

  /** Tire la boule chargee dans la direction donnee et resout le plateau. */
  fire(dir: Vec2): ShotResult {
    if (this.state !== 'playing') throw new Error('GameSession.fire : la partie est terminee');
    const color = this.sequencer.current;
    this.shots++;
    const flight = this.predict(dir);
    const result: ShotResult = {
      shotIndex: this.shots,
      color,
      flight,
      resolution: { steps: [], matched: 0, dropped: 0, chainLength: 0, matches: 0 },
      contacts: [],
      won: false,
    };

    if (flight.outcome === 'attached') {
      const from = { x: flight.endX, y: flight.endY };
      const to = this.board.nestle(from.x, from.y, flight.attachSurface === 'ball' ? flight.attachTargetId : undefined);
      const ball = this.board.addBall(to.x, to.y, color);
      result.ballId = ball.id;
      result.attachFrom = from;
      result.attachTo = to;
      result.contacts = this.board.neighbors(ball).map((n) => ({ id: n.id, x: n.x, y: n.y }));
      const resolution = resolveBoard(this.board, this.level.physics, ball.id);
      result.resolution = resolution;
      this.matches += resolution.matches;
      this.maxChain = Math.max(this.maxChain, resolution.chainLength);
      this.ballsMatched += resolution.matched;
      this.ballsDropped += resolution.dropped;
    }

    if (this.board.count === 0) {
      this.state = 'won';
      result.won = true;
    }
    return result;
  }

  result(): LevelResult {
    return {
      shots: this.shots,
      timeMs: Math.round(this.timeMs),
      matches: this.matches,
      maxChain: this.maxChain,
      ballsMatched: this.ballsMatched,
      ballsDropped: this.ballsDropped,
    };
  }

  trophy(): TrophyTier {
    return evaluateTrophy(this.level.trophies, this.result());
  }
}
