/**
 * Le canon : un socle de laiton et de verre au bas du cadre, la bille chargee,
 * l'anneau de compte a rebours de la couleur, la bille "suivante" en aperçu,
 * et le guide de tir qui suit la visee.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ColorId } from '@core/model/types';
import { colorSpec } from '@data/colors';
import { BallView } from './ballView';
import type { TextureRegistry } from '../textures/registry';
import { Easing, type Tweens } from '../tween';

const GOLD = 0xd8b86a;

export class CannonView extends Container {
  readonly loaded: BallView;
  readonly nextGem: BallView;
  private readonly base = new Graphics();
  private readonly guide = new Graphics();
  private readonly ring = new Graphics();
  private readonly nextLabel: Text;
  private readonly radius: number;
  private aimAngle = -Math.PI / 2;
  private warning = 0;
  private time = 0;
  private swapping = false;

  constructor(
    private readonly textures: TextureRegistry,
    radius: number,
    color: ColorId,
    nextColor: ColorId,
    glowEnabled: boolean,
  ) {
    super();
    this.label = 'cannon';
    this.radius = radius;
    this.drawBase();
    this.addChild(this.base, this.guide, this.ring);

    this.loaded = new BallView(textures, color, radius, glowEnabled, 101);
    this.addChild(this.loaded);

    this.nextGem = new BallView(textures, nextColor, radius * 0.46, glowEnabled, 202);
    this.nextGem.position.set(radius * 2.55, radius * 0.35);
    this.nextGem.breathing = false;
    this.addChild(this.nextGem);

    this.nextLabel = new Text({
      text: 'suivante',
      style: new TextStyle({
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: radius * 0.42,
        fill: 0xcfc6e6,
        fontStyle: 'italic',
      }),
    });
    this.nextLabel.anchor.set(0.5, 0);
    this.nextLabel.alpha = 0.75;
    this.nextLabel.position.set(this.nextGem.x, this.nextGem.y + radius * 0.62);
    this.addChild(this.nextLabel);
    this.drawRing(0, color);
  }

  private drawBase(): void {
    const r = this.radius;
    const g = this.base;
    g.clear();
    // Ombre douce sous le socle.
    g.ellipse(0, r * 1.15, r * 1.9, r * 0.45).fill({ color: 0x000000, alpha: 0.35 });
    // Plateau de verre sombre.
    g.circle(0, 0, r * 1.48).fill({ color: 0x1a1530, alpha: 0.92 });
    g.circle(0, 0, r * 1.48).stroke({ color: GOLD, width: 3, alpha: 0.95 });
    g.circle(0, 0, r * 1.3).stroke({ color: GOLD, width: 1, alpha: 0.35 });
    // Reflet en croissant sur le plateau.
    g.arc(0, 0, r * 1.38, Math.PI * 1.08, Math.PI * 1.72).stroke({ color: 0xffffff, width: 2, alpha: 0.25 });
  }

  /** Anneau de compte a rebours : 1 = plein, 0 = la couleur va changer. */
  private drawRing(progress: number, color: ColorId): void {
    const r = this.radius;
    const g = this.ring;
    g.clear();
    const spec = colorSpec(color);
    const remaining = 1 - progress;
    const start = -Math.PI / 2;
    const end = start + remaining * Math.PI * 2;
    g.circle(0, 0, r * 1.18).stroke({ color: 0xffffff, width: 4, alpha: 0.08 });
    if (remaining > 0.002) {
      const pulse = this.warning > 0 ? 0.5 + 0.5 * Math.sin(this.time * 18) : 0;
      const col = this.warning > 0 ? mixColor(spec.glow, 0xffffff, 0.35 + 0.5 * pulse * this.warning) : spec.glow;
      g.arc(0, 0, r * 1.18, start, end).stroke({ color: col, width: 4 + 2 * this.warning * pulse, alpha: 0.95, cap: 'round' });
    }
  }

  setAim(dirX: number, dirY: number, visible: boolean): void {
    this.aimAngle = Math.atan2(dirY, dirX);
    this.guide.clear();
    if (!visible) return;
    const r = this.radius;
    const cos = Math.cos(this.aimAngle);
    const sin = Math.sin(this.aimAngle);
    const px = -sin;
    const py = cos;
    const a = r * 1.05;
    const b = r * 2.2;
    const w = r * 0.62;
    // Deux rails de laiton qui s'ecartent legerement : le guide du tir.
    this.guide
      .moveTo(cos * a + px * w * 0.8, sin * a + py * w * 0.8)
      .lineTo(cos * b + px * w, sin * b + py * w)
      .moveTo(cos * a - px * w * 0.8, sin * a - py * w * 0.8)
      .lineTo(cos * b - px * w, sin * b - py * w)
      .stroke({ color: GOLD, width: 3, alpha: 0.85, cap: 'round' });
  }

  /** Mise a jour continue : anneau, signal de changement imminent, respiration. */
  update(dtMs: number, progress: number, warningIntensity: number, color: ColorId, nextColor: ColorId): void {
    this.time += dtMs / 1000;
    this.warning = warningIntensity;
    this.drawRing(progress, color);
    if (!this.swapping) {
      if (this.loaded.color !== color) this.swap(color);
      if (warningIntensity > 0) {
        // Clignotement elegant : la bille palpite de plus en plus vite avant la bascule.
        const k = 1 + 0.05 * warningIntensity * Math.sin(this.time * (12 + 10 * warningIntensity));
        this.loaded.body.scale.set((this.radius / this.textures.ballTextureRadius) * k);
        this.loaded.glow.alpha = 0.32 + 0.4 * warningIntensity * (0.5 + 0.5 * Math.sin(this.time * 14));
        this.loaded.breathing = false;
      } else if (!this.loaded.breathing) {
        this.loaded.breathing = true;
      }
    }
    this.nextGem.setColor(nextColor);
    this.loaded.breathe(this.time);
  }

  private swapTweens: Tweens | null = null;

  bindTweens(tweens: Tweens): void {
    this.swapTweens = tweens;
  }

  /** La bille chargee change de couleur : elle se contracte, change, revient en rebondissant. */
  private async swap(color: ColorId): Promise<void> {
    const tweens = this.swapTweens;
    if (!tweens) {
      this.loaded.setColor(color);
      return;
    }
    this.swapping = true;
    const s = this.radius / this.textures.ballTextureRadius;
    await tweens.to(this.loaded.body.scale, { x: s * 0.2, y: s * 0.2 }, 110, Easing.inQuad);
    this.loaded.setColor(color);
    await this.loaded.pop(tweens, 1.2);
    this.swapping = false;
  }

  /** Recul du socle au tir ; la bille chargee reapparait en rebondissant. */
  async recoil(tweens: Tweens): Promise<void> {
    this.loaded.visible = false;
    this.base.scale.set(1.08, 0.9);
    void tweens.to(this.base.scale, { x: 1, y: 1 }, 320, Easing.outElastic);
    await tweens.delay(140);
    this.loaded.visible = true;
    await this.loaded.pop(tweens, 0.9);
  }

  /** Angle de visee courant (radians, 0 = droite, -PI/2 = haut). */
  get aimAngleRad(): number {
    return this.aimAngle;
  }
}

function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
