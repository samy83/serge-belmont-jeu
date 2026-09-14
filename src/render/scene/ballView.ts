/**
 * Une bille a l'ecran : la texture de verre, sa lueur coloree en dessous, et
 * les petits mouvements qui la rendent vivante (pose, respiration, secousse).
 * La position est en unites logiques du plateau.
 */
import { Container, Sprite } from 'pixi.js';
import type { ColorId } from '@core/model/types';
import { colorSpec } from '@data/colors';
import type { TextureRegistry } from '../textures/registry';
import { Easing, type Tweens } from '../tween';

export class BallView extends Container {
  readonly body: Sprite;
  readonly glow: Sprite;
  color: ColorId;
  /** Phase de respiration propre a chaque bille (evite l'effet "tout bouge ensemble"). */
  private readonly phase: number;
  private readonly baseScale: number;
  private readonly glowScale: number;
  breathing = true;

  constructor(
    private readonly textures: TextureRegistry,
    color: ColorId,
    radius: number,
    glowEnabled: boolean,
    seed = 0,
  ) {
    super();
    this.color = color;
    this.phase = (seed * 0.618) % 1;
    const spec = colorSpec(color);
    this.glow = new Sprite(textures.glow);
    this.glow.anchor.set(0.5);
    this.glow.tint = spec.glow;
    this.glow.alpha = 0.32;
    this.glow.blendMode = 'add';
    this.glowScale = (radius * 2.3) / 128;
    this.glow.scale.set(this.glowScale);
    this.glow.visible = glowEnabled;
    this.addChild(this.glow);

    this.body = new Sprite(textures.ball(color));
    this.body.anchor.set(0.5);
    this.baseScale = radius / textures.ballTextureRadius;
    this.body.scale.set(this.baseScale);
    // Petites variations naturelles : luminosite a peine differente d'une bille a l'autre.
    const v = 0xf2 + Math.round(((seed * 7919) % 13) / 12 * 13);
    this.body.tint = (v << 16) | (v << 8) | v;
    this.addChild(this.body);
  }

  setColor(color: ColorId): void {
    if (color === this.color) return;
    this.color = color;
    this.body.texture = this.textures.ball(color);
    this.glow.tint = colorSpec(color).glow;
  }

  setGlowEnabled(on: boolean): void {
    this.glow.visible = on;
  }

  /** Respiration subtile (appelee chaque image avec le temps global en secondes). */
  breathe(time: number): void {
    if (!this.breathing) return;
    const k = 1 + Math.sin(time * 1.6 + this.phase * Math.PI * 2) * 0.012;
    this.body.scale.set(this.baseScale * k);
    this.glow.alpha = 0.3 + Math.sin(time * 1.1 + this.phase * 6.28) * 0.05;
  }

  /** Petit rebond elastique (pose, contact). */
  pop(tweens: Tweens, strength = 1): Promise<void> {
    this.breathing = false;
    const s = this.baseScale;
    this.body.scale.set(s * (1 + 0.28 * strength), s * (1 - 0.18 * strength));
    return tweens.to(this.body.scale, { x: s, y: s }, 380, Easing.outElastic).then(() => {
      this.breathing = true;
    });
  }

  /** Tremblement puis contraction avant l'explosion. */
  async crack(tweens: Tweens, durationMs: number): Promise<void> {
    this.breathing = false;
    const s = this.baseScale;
    const startX = this.x;
    const startY = this.y;
    await tweens.run(durationMs, (t) => {
      const amp = 2.5 + 3.5 * t;
      this.x = startX + Math.sin(t * 90) * amp;
      this.y = startY + Math.cos(t * 77) * amp;
      const k = 1 + 0.1 * Math.sin(t * 40) * t - 0.16 * t * t;
      this.body.scale.set(s * k);
      this.glow.alpha = 0.32 + 0.6 * t;
      this.glow.scale.set(this.glowScale * (1 + 0.6 * t));
    });
    this.x = startX;
    this.y = startY;
  }

  /** Secousse de contact (quand une voisine se pose). */
  jiggle(tweens: Tweens, dx: number, dy: number, strength = 1): Promise<void> {
    const ox = this.x;
    const oy = this.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = (dx / len) * 5 * strength;
    const py = (dy / len) * 5 * strength;
    return tweens.run(260, (t) => {
      const k = Math.sin(t * Math.PI) * (1 - t);
      this.x = ox + px * k * 2;
      this.y = oy + py * k * 2;
    }).then(() => {
      this.x = ox;
      this.y = oy;
    });
  }
}
