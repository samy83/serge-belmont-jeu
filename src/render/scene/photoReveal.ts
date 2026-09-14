/**
 * La revelation de la photographie.
 *
 * Deux couches : la PHOTO (en dessous, cadree "cover" dans le cadre) et le
 * VOILE (au-dessus : le velours du fond). Le voile est peint une fois dans une
 * texture de rendu ; chaque explosion y "efface" un disque a bord doux
 * (mode de fusion erase). Pas de filtre ni de masque : une seule sprite de
 * plus a dessiner, ce qui convient aux vieux mobiles.
 */
import { Assets, Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import type { PhotoDef, RevealDef } from '@core/model/types';
import { makeCanvas, makeVeilCanvas, toTexture } from '../textures/procedural';
import type { TextureRegistry } from '../textures/registry';
import { Easing, type Tweens } from '../tween';

export class PhotoReveal {
  readonly container = new Container();
  readonly photo = new Sprite();
  readonly veil: Sprite;
  private readonly veilTexture: RenderTexture;
  private readonly veilArt: Sprite;
  private readonly brush: Sprite;
  /** Racine du rendu du pinceau : le mode de fusion d'un objet racine n'est pas pris en compte par Pixi. */
  private readonly brushRoot = new Container();
  private readonly rtScale: number;
  private readonly photoMask: Graphics;
  /** Part de la surface revelee (0..1), estimee par les disques effaces. */
  revealedArea = 0;
  private revealedDisks: Array<{ x: number; y: number; r: number }> = [];

  constructor(
    private readonly renderer: Renderer,
    private readonly textures: TextureRegistry,
    readonly frameW: number,
    readonly frameH: number,
    private readonly reveal: RevealDef,
    veilScale = 0.5,
  ) {
    this.container.label = 'photoReveal';
    const rtW = Math.round(frameW * veilScale);
    const rtH = Math.round(frameH * veilScale);
    this.rtScale = veilScale;
    this.veilTexture = RenderTexture.create({ width: rtW, height: rtH, resolution: 1 });
    this.veilArt = new Sprite(toTexture(makeVeilCanvas(rtW, rtH)));

    this.brush = new Sprite(textures.brush(reveal.softness));
    this.brush.anchor.set(0.5);
    this.brush.blendMode = 'erase';
    this.brushRoot.addChild(this.brush);

    this.photoMask = new Graphics().rect(0, 0, frameW, frameH).fill(0xffffff);
    this.photo.mask = this.photoMask;
    this.container.addChild(this.photo, this.photoMask);

    this.veil = new Sprite(this.veilTexture);
    this.veil.width = frameW;
    this.veil.height = frameH;
    this.container.addChild(this.veil);
    this.resetVeil();
  }

  /** Repeint le voile intact (nouveau niveau, recommencer). */
  resetVeil(): void {
    this.renderer.render({ container: this.veilArt, target: this.veilTexture, clear: true });
    this.veil.alpha = 1;
    this.revealedDisks = [];
    this.revealedArea = 0;
  }

  /** Charge la photo du niveau ; en cas d'echec, une image de secours generee. */
  async loadPhoto(def: PhotoDef, baseUrl: string): Promise<void> {
    let texture: Texture;
    try {
      texture = await Assets.load<Texture>({ src: baseUrl + def.src, alias: def.src });
    } catch (err) {
      console.warn(`[photo] impossible de charger ${def.src}, image de secours utilisee`, err);
      texture = this.fallbackTexture(def.title ?? def.src);
    }
    this.photo.texture = texture;
    this.fitPhoto(def);
  }

  private fitPhoto(def: PhotoDef): void {
    const tw = this.photo.texture.width;
    const th = this.photo.texture.height;
    if (tw === 0 || th === 0) return;
    const cover = def.fit !== 'contain';
    const s = (cover ? Math.max(this.frameW / tw, this.frameH / th) : Math.min(this.frameW / tw, this.frameH / th)) * def.scale;
    this.photo.scale.set(s);
    const w = tw * s;
    const h = th * s;
    // Le point de focus reste au centre du cadre, sans jamais decouvrir le bord.
    let x = this.frameW / 2 - w * def.focusX;
    let y = this.frameH / 2 - h * def.focusY;
    if (cover) {
      x = Math.min(0, Math.max(this.frameW - w, x));
      y = Math.min(0, Math.max(this.frameH - h, y));
    } else {
      x = (this.frameW - w) / 2;
      y = (this.frameH - h) / 2;
    }
    this.photo.position.set(x, y);
  }

  private fallbackTexture(label: string): Texture {
    const [canvas, ctx] = makeCanvas(450, 640);
    const g = ctx.createLinearGradient(0, 0, 450, 640);
    g.addColorStop(0, '#c9a46a');
    g.addColorStop(0.5, '#7a5a3e');
    g.addColorStop(1, '#2e2020');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 450, 640);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 225, 330);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('photographie indisponible', 225, 362);
    return toTexture(canvas);
  }

  /** Rayon revele autour d'une bille detruite, en unites logiques. */
  revealRadius(ballRadius: number): number {
    return ballRadius * this.reveal.radiusFactor;
  }

  /** Efface un disque du voile, en s'ouvrant progressivement (onde de revelation). */
  async revealAt(tweens: Tweens, x: number, y: number, radius: number, durationMs = 420): Promise<void> {
    this.revealedDisks.push({ x, y, r: radius });
    await tweens.run(
      durationMs,
      (t) => {
        const r = radius * (0.25 + 0.75 * t);
        this.paint(x, y, r);
      },
      Easing.outCubic,
    );
    this.paint(x, y, radius);
    this.estimateArea();
  }

  /** Efface immediatement (sans animation). */
  revealNow(x: number, y: number, radius: number): void {
    this.revealedDisks.push({ x, y, r: radius });
    this.paint(x, y, radius);
    this.estimateArea();
  }

  private paint(x: number, y: number, radius: number): void {
    const size = this.brush.texture.width;
    this.brush.position.set(x * this.rtScale, y * this.rtScale);
    this.brush.scale.set((radius * 2 * this.rtScale) / size);
    this.renderer.render({ container: this.brushRoot, target: this.veilTexture, clear: false });
  }

  /** Fait disparaitre tout le voile (fin de niveau). */
  revealAll(tweens: Tweens, durationMs = 1400): Promise<void> {
    this.revealedArea = 1;
    return tweens.to(this.veil, { alpha: 0 }, durationMs, Easing.inOutSine);
  }

  private estimateArea(): void {
    // Estimation par echantillonnage sur une grille : suffisant pour une jauge.
    const step = 30;
    let inside = 0;
    let total = 0;
    for (let y = step / 2; y < this.frameH; y += step) {
      for (let x = step / 2; x < this.frameW; x += step) {
        total++;
        for (const d of this.revealedDisks) {
          const dx = x - d.x;
          const dy = y - d.y;
          if (dx * dx + dy * dy <= d.r * d.r * 0.8) {
            inside++;
            break;
          }
        }
      }
    }
    this.revealedArea = total > 0 ? inside / total : 0;
  }

  destroy(): void {
    this.veilTexture.destroy(true);
    this.veilArt.destroy({ texture: true, textureSource: true });
    this.brushRoot.destroy({ children: true });
    this.container.destroy({ children: true });
  }
}
