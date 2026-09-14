/**
 * La scene d'un niveau : photo et voile, cadre, obstacles, billes, ligne de
 * visee, effets, canon. Elle rejoue les resultats du coeur (vol, pose,
 * explosions, chutes) sous forme d'animations, et ne decide jamais rien.
 */
import { Container, Graphics, Sprite, type Renderer } from 'pixi.js';
import type { GameSession, ShotResult } from '@core/game/session';
import type { ResolutionStep } from '@core/board/resolve';
import type { Vec2 } from '@core/model/types';
import { flightPolyline, flightPositionAt } from '@core/physics/flight';
import { colorSpec } from '@data/colors';
import { Effects } from '../fx/effects';
import type { QualityProfile } from '../quality';
import type { TextureRegistry } from '../textures/registry';
import { CancelToken, Easing, type Tweens } from '../tween';
import { BallView } from './ballView';
import { CannonView } from './cannonView';
import { PhotoReveal } from './photoReveal';
import { TrajectoryView } from './trajectoryView';

export type FxEvent =
  | { type: 'shoot' }
  | { type: 'bounce'; surface: 'wall' | 'obstacle' }
  | { type: 'attach' }
  | { type: 'lost' }
  | { type: 'crack'; size: number }
  | { type: 'explode'; size: number; chain: number }
  | { type: 'reveal'; amount: number }
  | { type: 'land' }
  | { type: 'drop'; count: number }
  | { type: 'colorChange' }
  | { type: 'win' };

const GOLD = 0xd8b86a;

export class LevelView {
  readonly root = new Container();
  readonly photoReveal: PhotoReveal;
  readonly cannon: CannonView;
  readonly trajectory = new TrajectoryView();
  readonly effects: Effects;
  private readonly ballsLayer = new Container();
  private readonly obstaclesLayer = new Container();
  private readonly frame = new Graphics();
  private readonly balls = new Map<number, BallView>();
  private time = 0;
  private moteTimer = 0;
  private lastColor: string;
  private seedCounter = 1;

  constructor(
    private readonly renderer: Renderer,
    readonly session: GameSession,
    private readonly textures: TextureRegistry,
    private quality: QualityProfile,
    private readonly tweens: Tweens,
    private readonly onFx: (e: FxEvent) => void,
  ) {
    const level = session.level;
    const b = level.board;
    this.root.label = 'level';

    this.photoReveal = new PhotoReveal(renderer, textures, b.width, b.floorY, level.reveal);
    this.effects = new Effects(textures, quality);
    this.drawFrame();

    this.cannon = new CannonView(textures, b.ballRadius, session.currentColor, session.sequencer.next, quality.ballGlow);
    this.cannon.position.set(session.cannonX, session.cannonY);
    this.cannon.bindTweens(tweens);
    this.lastColor = session.currentColor;

    this.root.addChild(this.photoReveal.container, this.obstaclesLayer, this.frame, this.trajectory, this.ballsLayer, this.effects.layer, this.cannon);
    this.buildObstacles();
    this.buildBalls();
  }

  /** Charge la photo (asynchrone : le jeu peut commencer avant). */
  init(baseUrl: string): Promise<void> {
    return this.photoReveal.loadPhoto(this.session.level.photo, baseUrl);
  }

  setQuality(q: QualityProfile): void {
    this.quality = q;
    this.effects.setQuality(q);
    for (const v of this.balls.values()) v.setGlowEnabled(q.ballGlow);
    this.cannon.loaded.setGlowEnabled(q.ballGlow);
    this.cannon.nextGem.setGlowEnabled(q.ballGlow);
  }

  private drawFrame(): void {
    const b = this.session.level.board;
    const g = this.frame;
    g.clear();
    // Liseres du cadre : un trait d'or fin, un second plus discret a l'interieur.
    g.roundRect(1.5, 1.5, b.width - 3, b.floorY - 3, 6).stroke({ color: GOLD, width: 3, alpha: 0.9 });
    g.roundRect(10, 10, b.width - 20, b.floorY - 20, 4).stroke({ color: GOLD, width: 1, alpha: 0.28 });
    // Coins ornes.
    const c = 34;
    const corners: Array<[number, number, number, number]> = [
      [14, 14, 1, 1],
      [b.width - 14, 14, -1, 1],
      [14, b.floorY - 14, 1, -1],
      [b.width - 14, b.floorY - 14, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      g.moveTo(x, y + sy * c)
        .lineTo(x, y)
        .lineTo(x + sx * c, y)
        .stroke({ color: GOLD, width: 2, alpha: 0.7 });
      g.circle(x + sx * 8, y + sy * 8, 2.2).fill({ color: GOLD, alpha: 0.9 });
    }
    // Ligne de chute : a peine suggeree.
    g.moveTo(0, b.floorY + 1.5)
      .lineTo(b.width, b.floorY + 1.5)
      .stroke({ color: GOLD, width: 1, alpha: 0.2 });
  }

  private buildObstacles(): void {
    for (const o of this.session.board.obstacles) {
      const s = new Sprite(this.textures.block(o.w, o.h));
      s.position.set(o.x, o.y);
      s.width = o.w;
      s.height = o.h;
      this.obstaclesLayer.addChild(s);
    }
  }

  private buildBalls(): void {
    for (const b of this.session.board.all()) this.addBallView(b.id, b.x, b.y, b.color);
  }

  private addBallView(id: number, x: number, y: number, color: string): BallView {
    const r = this.session.level.board.ballRadius;
    const v = new BallView(this.textures, color, r, this.quality.ballGlow, this.seedCounter++);
    v.position.set(x, y);
    this.ballsLayer.addChild(v);
    this.balls.set(id, v);
    return v;
  }

  private removeBallView(id: number): void {
    const v = this.balls.get(id);
    if (!v) return;
    this.balls.delete(id);
    v.destroy({ children: true });
  }

  /** Mise a jour continue (appelee chaque image). */
  update(dtMs: number): void {
    this.time += dtMs / 1000;
    const seq = this.session.sequencer;
    this.cannon.position.x = this.session.cannonX;
    this.cannon.update(dtMs, seq.progress, seq.warningIntensity, seq.current, seq.next);
    if (seq.current !== this.lastColor) {
      this.lastColor = seq.current;
      this.onFx({ type: 'colorChange' });
      this.effects.flash(this.session.cannonX, this.session.cannonY, colorSpec(seq.current).glow, 0.55, 0.3);
    }
    this.trajectory.update(dtMs);
    this.effects.update(dtMs);
    this.root.position.set(this.effects.shakeX, this.effects.shakeY);
    if (this.quality.idleBreathing) {
      for (const v of this.balls.values()) v.breathe(this.time);
    }
    if (this.quality.ambientMotes > 0) {
      this.moteTimer += dtMs;
      const every = 6000 / this.quality.ambientMotes;
      if (this.moteTimer > every) {
        this.moteTimer = 0;
        const b = this.session.level.board;
        this.effects.mote(20 + Math.random() * (b.width - 40), b.floorY * (0.2 + Math.random() * 0.8));
      }
    }
  }

  /** Affiche la ligne de visee pour une direction (ou la cache si null). */
  setAim(dir: Vec2 | null): void {
    if (!dir) {
      this.trajectory.hide();
      this.cannon.setAim(0, -1, false);
      return;
    }
    const flight = this.session.predict(dir);
    const pts = flightPolyline(flight, this.session.level.difficulty.predictionBounces);
    let landing: Vec2 | null = null;
    if (flight.outcome === 'attached') {
      landing = this.session.board.nestle(flight.endX, flight.endY, flight.attachSurface === 'ball' ? flight.attachTargetId : undefined);
    }
    this.trajectory.show(pts, landing, this.session.currentColor, this.session.level.board.ballRadius);
    this.cannon.setAim(dir.x, dir.y, true);
  }

  /** Rejoue un tir complet : vol, pose, explosions, chutes. */
  async playShot(shot: ShotResult, token: CancelToken): Promise<void> {
    const level = this.session.level;
    const r = level.board.ballRadius;
    const spec = colorSpec(shot.color);
    this.trajectory.hide();
    this.cannon.setAim(0, -1, false);
    this.onFx({ type: 'shoot' });

    const flying = new BallView(this.textures, shot.color, r, this.quality.ballGlow, this.seedCounter++);
    flying.breathing = false;
    flying.position.set(this.session.cannonX, this.session.cannonY);
    this.ballsLayer.addChild(flying);
    void this.cannon.recoil(this.tweens);
    this.effects.flash(this.session.cannonX, this.session.cannonY - r * 0.6, spec.glow, 0.5, 0.18);

    const flight = shot.flight;
    let next = 0;
    await this.tweens.run(flight.duration * 1000, (t) => {
      const time = t * flight.duration;
      const p = flightPositionAt(flight, time);
      flying.position.set(p.x, p.y);
      while (next < flight.events.length && flight.events[next]!.t <= time) {
        const e = flight.events[next++]!;
        if (e.type === 'bounce') {
          this.effects.bounceSparks(e.x, e.y, e.nx, e.ny, spec.glow);
          this.onFx({ type: 'bounce', surface: e.surface === 'obstacle' ? 'obstacle' : 'wall' });
          void flying.pop(this.tweens, 0.6);
        }
      }
    });
    if (token.cancelled) return;

    if (flight.outcome !== 'attached' || shot.ballId === undefined || !shot.attachFrom || !shot.attachTo) {
      this.onFx({ type: 'lost' });
      await this.tweens.to(flying, { alpha: 0 }, 220, Easing.outQuad);
      flying.destroy({ children: true });
      return;
    }

    // Pose : contact, puis la bille se blottit contre ses voisines.
    flying.position.set(shot.attachFrom.x, shot.attachFrom.y);
    this.balls.set(shot.ballId, flying);
    this.onFx({ type: 'attach' });
    this.effects.flash(shot.attachTo.x, shot.attachTo.y, spec.glow, 0.45, 0.22);
    for (const n of shot.contacts) {
      const v = this.balls.get(n.id);
      if (v) void v.jiggle(this.tweens, n.x - shot.attachTo.x, n.y - shot.attachTo.y, 0.8);
    }
    await Promise.all([
      this.tweens.to(flying, { x: shot.attachTo.x, y: shot.attachTo.y }, 140, Easing.outBack),
      flying.pop(this.tweens, 0.8),
    ]);
    if (token.cancelled) return;

    for (const step of shot.resolution.steps) {
      if (token.cancelled) return;
      if (step.type === 'match') await this.playMatch(step);
      else await this.playFall(step);
    }

    if (shot.won && !token.cancelled) await this.playVictory();
  }

  private async playMatch(step: Extract<ResolutionStep, { type: 'match' }>): Promise<void> {
    const r = this.session.level.board.ballRadius;
    const spec = colorSpec(step.color);
    const size = step.ballIds.length;
    const views = step.ballIds.map((id) => this.balls.get(id)).filter((v): v is BallView => v !== undefined);
    const intensity = Math.min(2.2, 0.9 + 0.08 * size + 0.35 * step.chain);
    this.onFx({ type: 'crack', size });
    await Promise.all(views.map((v) => v.crack(this.tweens, 190 + 50 * Math.min(step.chain, 3))));

    this.onFx({ type: 'explode', size, chain: step.chain });
    this.effects.flash(step.centerX, step.centerY, spec.glow, 1.3 + 0.18 * size, 0.32);
    this.effects.ring(step.centerX, step.centerY, spec.glow, 1.4 + 0.25 * size, 0.55);
    this.effects.ring(step.centerX, step.centerY, 0xffffff, 0.9 + 0.2 * size, 0.4, 0.6);
    this.effects.shake(2 + size * 0.7 + step.chain * 2.5, 200 + size * 20);
    const positions: Vec2[] = [];
    for (const id of step.ballIds) {
      const v = this.balls.get(id);
      if (!v) continue;
      positions.push({ x: v.x, y: v.y });
      this.effects.burst(v.x, v.y, spec.glow, r, intensity);
      this.removeBallView(id);
    }
    const revealR = this.photoReveal.revealRadius(r);
    this.onFx({ type: 'reveal', amount: size });
    await Promise.all(positions.map((p) => this.photoReveal.revealAt(this.tweens, p.x, p.y, revealR, 420)));
    await this.tweens.delay(140);
  }

  private async playFall(step: Extract<ResolutionStep, { type: 'fall' }>): Promise<void> {
    const r = this.session.level.board.ballRadius;
    const revealR = this.photoReveal.revealRadius(r);
    const promises: Promise<unknown>[] = [];
    let dropped = 0;
    let landed = 0;
    for (const cluster of step.clusters) {
      const dist = cluster.distance;
      const fallMs = Math.max(160, Math.min(640, Math.sqrt((2 * dist) / 3800) * 1000));
      for (const id of cluster.ballIds) {
        const v = this.balls.get(id);
        if (!v) continue;
        v.breathing = false;
        const startY = v.y;
        if (cluster.landed) {
          promises.push(this.tweens.to(v, { y: startY + dist }, fallMs, Easing.inQuad).then(() => v.pop(this.tweens, 0.7)));
        } else {
          const spec = colorSpec(v.color);
          void this.photoReveal.revealAt(this.tweens, v.x, v.y, revealR, 500);
          this.effects.ring(v.x, v.y, spec.glow, 0.8, 0.5, 0.5);
          promises.push(
            this.tweens.to(v, { y: startY + dist + 320, alpha: 0 }, fallMs + 360, Easing.inQuad).then(() => this.removeBallView(id)),
          );
        }
      }
      if (cluster.landed) landed += cluster.ballIds.length;
      else dropped += cluster.ballIds.length;
    }
    if (dropped > 0) this.onFx({ type: 'drop', count: dropped });
    await Promise.all(promises);
    if (landed > 0) {
      this.onFx({ type: 'land' });
      this.effects.shake(1.5, 120);
    }
    await this.tweens.delay(120);
  }

  /** Fin de niveau : lumiere, onde, et la photographie entiere. */
  async playVictory(): Promise<void> {
    const b = this.session.level.board;
    this.onFx({ type: 'win' });
    this.trajectory.hide();
    for (let i = 0; i < 3; i++) {
      this.effects.ring(b.width / 2, b.floorY / 2, GOLD, 4 + i * 2, 1.1 + i * 0.2, 0.5);
    }
    this.effects.flash(b.width / 2, b.floorY / 2, 0xfff2d0, 5, 0.9);
    for (let i = 0; i < 24; i++) this.effects.mote(Math.random() * b.width, b.floorY * Math.random());
    await this.photoReveal.revealAll(this.tweens, 1500);
  }

  /** Vide la scene sans attendre les animations (changement d'ecran). */
  destroy(): void {
    this.effects.clear();
    for (const id of Array.from(this.balls.keys())) this.removeBallView(id);
    this.photoReveal.destroy();
    this.root.destroy({ children: true });
  }
}
