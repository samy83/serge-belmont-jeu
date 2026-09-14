/**
 * La ligne de visee : un chapelet de points lumineux qui coulent le long de la
 * trajectoire prevue (rebonds compris), et une bille fantome a l'arrivee.
 * Les points viennent de la meme simulation que le tir : la ligne dit vrai.
 */
import { Container, Graphics } from 'pixi.js';
import type { Vec2 } from '@core/model/types';
import { colorSpec } from '@data/colors';

export class TrajectoryView extends Container {
  private readonly dots = new Graphics();
  private readonly ghost = new Graphics();
  private points: Vec2[] = [];
  private landing: Vec2 | null = null;
  private lineTint = 0xffffff;
  private phase = 0;
  private ballRadius = 42;
  private dirty = false;

  constructor() {
    super();
    this.label = 'trajectory';
    this.addChild(this.dots, this.ghost);
    this.visible = false;
  }

  show(points: Vec2[], landing: Vec2 | null, color: string, radius: number): void {
    this.points = points;
    this.landing = landing;
    this.lineTint = colorSpec(color).glow;
    this.ballRadius = radius;
    this.visible = true;
    this.dirty = true;
  }

  hide(): void {
    this.visible = false;
    this.dots.clear();
    this.ghost.clear();
  }

  update(dtMs: number): void {
    if (!this.visible) return;
    this.phase = (this.phase + dtMs * 0.00035) % 1;
    this.redraw();
  }

  private redraw(): void {
    const g = this.dots;
    g.clear();
    const spacing = 26;
    let total = 0;
    for (let i = 1; i < this.points.length; i++) {
      total += Math.hypot(this.points[i]!.x - this.points[i - 1]!.x, this.points[i]!.y - this.points[i - 1]!.y);
    }
    if (total <= 0) return;
    const maxDots = 90;
    let dist = this.phase * spacing;
    let count = 0;
    let before = 0; // longueur cumulee des segments deja parcourus
    for (let i = 1; i < this.points.length && count < maxDots; i++) {
      const a = this.points[i - 1]!;
      const b = this.points[i]!;
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (segLen <= 0) continue;
      let along = dist;
      while (along <= segLen && count < maxDots) {
        const t = along / segLen;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const travelled = (before + along) / total;
        const fade = 1 - Math.min(1, travelled) * 0.75;
        g.circle(x, y, 5.5).fill({ color: this.lineTint, alpha: 0.85 * fade });
        g.circle(x, y, 2.4).fill({ color: 0xffffff, alpha: 0.9 * fade });
        along += spacing;
        count++;
      }
      dist = along - segLen;
      before += segLen;
    }

    const gh = this.ghost;
    gh.clear();
    if (this.landing) {
      gh.circle(this.landing.x, this.landing.y, this.ballRadius).fill({ color: this.lineTint, alpha: 0.16 });
      gh.circle(this.landing.x, this.landing.y, this.ballRadius).stroke({ color: this.lineTint, width: 2.5, alpha: 0.65 });
      gh.circle(this.landing.x, this.landing.y, this.ballRadius * 0.35).stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
    }
    this.dirty = false;
  }

  get needsRedraw(): boolean {
    return this.dirty;
  }
}
