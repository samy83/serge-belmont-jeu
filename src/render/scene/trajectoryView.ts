/**
 * La ligne de visee : un chapelet de points lumineux qui coulent le long de la
 * trajectoire prevue (rebonds compris), et une bille fantome a l'arrivee.
 * Les points viennent de la meme simulation que le tir : la ligne dit vrai.
 *
 * Les points sont des sprites en reserve (pas de geometrie reconstruite a
 * chaque image) ; seul le fantome est un Graphics, redessine au changement.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import type { Vec2 } from '@core/model/types';
import { colorSpec } from '@data/colors';
import type { TextureRegistry } from '../textures/registry';

const MAX_DOTS = 90;
const SPACING = 26;

export class TrajectoryView extends Container {
  private readonly dots: Sprite[] = [];
  private readonly ghost = new Graphics();
  private points: Vec2[] = [];
  private landing: Vec2 | null = null;
  private lineTint = 0xffffff;
  private phase = 0;
  private ballRadius = 42;
  private ghostDirty = false;

  constructor(textures: TextureRegistry) {
    super();
    this.label = 'trajectory';
    this.addChild(this.ghost);
    for (let i = 0; i < MAX_DOTS; i++) {
      const s = new Sprite(textures.spark);
      s.anchor.set(0.5);
      s.visible = false;
      s.blendMode = 'add';
      this.dots.push(s);
      this.addChild(s);
    }
    this.visible = false;
  }

  show(points: Vec2[], landing: Vec2 | null, color: string, radius: number): void {
    this.points = points;
    const changed = !this.landing || !landing || this.landing.x !== landing.x || this.landing.y !== landing.y;
    this.landing = landing;
    const tint = colorSpec(color).glow;
    if (tint !== this.lineTint) {
      this.lineTint = tint;
      for (const d of this.dots) d.tint = tint;
      this.ghostDirty = true;
    }
    this.ballRadius = radius;
    this.visible = true;
    if (changed) this.ghostDirty = true;
    this.layoutDots();
  }

  hide(): void {
    this.visible = false;
    for (const d of this.dots) d.visible = false;
    this.ghost.clear();
    this.landing = null;
  }

  update(dtMs: number): void {
    if (!this.visible) return;
    this.phase = (this.phase + dtMs * 0.00035) % 1;
    this.layoutDots();
    if (this.ghostDirty) this.drawGhost();
  }

  private layoutDots(): void {
    let total = 0;
    for (let i = 1; i < this.points.length; i++) {
      total += Math.hypot(this.points[i]!.x - this.points[i - 1]!.x, this.points[i]!.y - this.points[i - 1]!.y);
    }
    let count = 0;
    if (total > 0) {
      let dist = this.phase * SPACING;
      let before = 0;
      for (let i = 1; i < this.points.length && count < MAX_DOTS; i++) {
        const a = this.points[i - 1]!;
        const b = this.points[i]!;
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        if (segLen <= 0) continue;
        let along = dist;
        while (along <= segLen && count < MAX_DOTS) {
          const t = along / segLen;
          const travelled = (before + along) / total;
          const fade = 1 - Math.min(1, travelled) * 0.7;
          const d = this.dots[count++]!;
          d.visible = true;
          d.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
          d.alpha = 0.95 * fade;
          d.scale.set(0.42 * (0.7 + 0.3 * fade));
          along += SPACING;
        }
        dist = along - segLen;
        before += segLen;
      }
    }
    for (let i = count; i < MAX_DOTS; i++) this.dots[i]!.visible = false;
  }

  private drawGhost(): void {
    const gh = this.ghost;
    gh.clear();
    if (this.landing) {
      const r = this.ballRadius;
      gh.circle(this.landing.x, this.landing.y, r).fill({ color: this.lineTint, alpha: 0.16 });
      gh.circle(this.landing.x, this.landing.y, r).stroke({ color: this.lineTint, width: 2.5, alpha: 0.65 });
      gh.circle(this.landing.x, this.landing.y, r * 0.35).stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
    }
    this.ghostDirty = false;
  }
}
