/**
 * Cache des textures procedurales : chaque texture n'est fabriquee qu'une fois
 * par session (les billes par couleur, les cases par taille).
 */
import { Texture } from 'pixi.js';
import { colorSpec } from '@data/colors';
import type { ColorId } from '@core/model/types';
import {
  makeBallCanvas,
  makeBlockCanvas,
  makeBrushCanvas,
  makeGlowCanvas,
  makeRingCanvas,
  makeShardCanvas,
  makeSparkCanvas,
  toTexture,
} from './procedural';

export class TextureRegistry {
  private readonly balls = new Map<ColorId, Texture>();
  private readonly blocks = new Map<string, Texture>();
  private readonly shards: Texture[] = [];
  private glowTex: Texture | null = null;
  private sparkTex: Texture | null = null;
  private ringTex: Texture | null = null;
  private brushTex: Texture | null = null;
  private brushSoftness = -1;

  /** Taille du canvas d'une bille ; la lueur et le rendu se calent dessus. */
  readonly ballSize: number;

  constructor(ballSize = 192) {
    this.ballSize = ballSize;
  }

  ball(color: ColorId): Texture {
    let t = this.balls.get(color);
    if (!t) {
      t = toTexture(makeBallCanvas(colorSpec(color), this.ballSize));
      this.balls.set(color, t);
    }
    return t;
  }

  /** Rayon (px du canvas) du disque de la bille dans sa texture. */
  get ballTextureRadius(): number {
    return this.ballSize * 0.44;
  }

  get glow(): Texture {
    if (!this.glowTex) this.glowTex = toTexture(makeGlowCanvas(128));
    return this.glowTex;
  }

  get spark(): Texture {
    if (!this.sparkTex) this.sparkTex = toTexture(makeSparkCanvas(32));
    return this.sparkTex;
  }

  get ring(): Texture {
    if (!this.ringTex) this.ringTex = toTexture(makeRingCanvas(128));
    return this.ringTex;
  }

  shard(index: number): Texture {
    if (this.shards.length === 0) {
      for (let i = 0; i < 4; i++) this.shards.push(toTexture(makeShardCanvas(40, i + 1)));
    }
    return this.shards[Math.abs(index) % this.shards.length]!;
  }

  brush(softness: number): Texture {
    if (!this.brushTex || this.brushSoftness !== softness) {
      this.brushTex = toTexture(makeBrushCanvas(128, softness));
      this.brushSoftness = softness;
    }
    return this.brushTex;
  }

  block(w: number, h: number): Texture {
    const key = `${Math.round(w)}x${Math.round(h)}`;
    let t = this.blocks.get(key);
    if (!t) {
      t = toTexture(makeBlockCanvas(w, h));
      this.blocks.set(key, t);
    }
    return t;
  }

  destroy(): void {
    for (const t of this.balls.values()) t.destroy(true);
    for (const t of this.blocks.values()) t.destroy(true);
    for (const t of this.shards) t.destroy(true);
    this.glowTex?.destroy(true);
    this.sparkTex?.destroy(true);
    this.ringTex?.destroy(true);
    this.brushTex?.destroy(true);
    this.balls.clear();
    this.blocks.clear();
    this.shards.length = 0;
    this.glowTex = this.sparkTex = this.ringTex = this.brushTex = null;
  }
}
