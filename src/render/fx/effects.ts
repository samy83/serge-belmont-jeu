/**
 * Effets visuels : etincelles, eclats de verre, ondes, flashs, secousse
 * d'ecran. Toutes les particules vivent dans des reserves (aucune allocation
 * pendant le jeu une fois la reserve chauffee) et respectent le plafond du
 * palier de qualite.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import type { QualityProfile } from '../quality';
import type { TextureRegistry } from '../textures/registry';
import { clamp01 } from '../tween';

interface Particle {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  spin: number;
  gravity: number;
  drag: number;
  scaleStart: number;
  scaleEnd: number;
  alphaStart: number;
  alphaEnd: number;
  active: boolean;
}

/** Generateur pseudo-aleatoire leger, dedie aux effets (le coeur du jeu n'en a pas). */
export class FxRandom {
  private s: number;
  constructor(seed = 1234567) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) >>> 0;
    return this.s / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

export class Effects {
  readonly layer = new Container();
  private readonly pool: Particle[] = [];
  private readonly rand = new FxRandom();
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeAmp = 0;
  shakeX = 0;
  shakeY = 0;

  constructor(
    private readonly textures: TextureRegistry,
    private quality: QualityProfile,
  ) {
    this.layer.label = 'effects';
  }

  setQuality(q: QualityProfile): void {
    this.quality = q;
  }

  private acquire(): Particle | null {
    for (const p of this.pool) if (!p.active) return p;
    if (this.pool.length >= this.quality.maxParticles) return null;
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    sprite.visible = false;
    this.layer.addChild(sprite);
    const p: Particle = {
      sprite,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      spin: 0,
      gravity: 0,
      drag: 0,
      scaleStart: 1,
      scaleEnd: 1,
      alphaStart: 1,
      alphaEnd: 0,
      active: false,
    };
    this.pool.push(p);
    return p;
  }

  private emit(opts: {
    texture: Texture;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    tint: number;
    scale: number;
    scaleEnd?: number;
    alpha?: number;
    spin?: number;
    gravity?: number;
    drag?: number;
    blend?: 'add' | 'normal';
    rotation?: number;
  }): void {
    const p = this.acquire();
    if (!p) return;
    p.active = true;
    p.x = opts.x;
    p.y = opts.y;
    p.vx = opts.vx;
    p.vy = opts.vy;
    p.life = 0;
    p.maxLife = opts.life;
    p.spin = opts.spin ?? 0;
    p.gravity = opts.gravity ?? 0;
    p.drag = opts.drag ?? 0;
    p.scaleStart = opts.scale;
    p.scaleEnd = opts.scaleEnd ?? opts.scale * 0.3;
    p.alphaStart = opts.alpha ?? 1;
    p.alphaEnd = 0;
    const s = p.sprite;
    s.texture = opts.texture;
    s.tint = opts.tint;
    s.blendMode = opts.blend ?? 'add';
    s.rotation = opts.rotation ?? 0;
    s.position.set(p.x, p.y);
    s.scale.set(p.scaleStart);
    s.alpha = p.alphaStart;
    s.visible = true;
  }

  /** Etincelles d'impact (rebond sur un bord ou un obstacle). */
  bounceSparks(x: number, y: number, nx: number, ny: number, tint: number): void {
    const n = this.quality.sparksPerBounce;
    const baseAngle = Math.atan2(ny, nx);
    for (let i = 0; i < n; i++) {
      const a = baseAngle + this.rand.range(-1.1, 1.1);
      const speed = this.rand.range(180, 520);
      this.emit({
        texture: this.textures.spark,
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: this.rand.range(0.18, 0.36),
        tint,
        scale: this.rand.range(0.9, 1.6),
        scaleEnd: 0.1,
        drag: 3,
      });
    }
    this.ring(x, y, tint, 0.6, 0.3);
  }

  /** Eclats et poussiere d'une bille qui explose. */
  burst(x: number, y: number, tint: number, radius: number, intensity = 1): void {
    const shards = Math.round(this.quality.shardsPerBall * intensity);
    for (let i = 0; i < shards; i++) {
      const a = this.rand.range(0, Math.PI * 2);
      const speed = this.rand.range(220, 700) * (0.8 + 0.4 * intensity);
      this.emit({
        texture: this.textures.shard(i + Math.floor(this.rand.next() * 4)),
        x: x + Math.cos(a) * radius * 0.4,
        y: y + Math.sin(a) * radius * 0.4,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 120,
        life: this.rand.range(0.45, 0.9),
        tint,
        scale: this.rand.range(0.9, 1.7) * (radius / 42),
        scaleEnd: 0.2,
        alpha: 0.95,
        spin: this.rand.range(-9, 9),
        gravity: 1500,
        drag: 0.8,
        blend: 'normal',
        rotation: this.rand.range(0, Math.PI * 2),
      });
    }
    const sparks = Math.round(this.quality.sparksPerBall * intensity);
    for (let i = 0; i < sparks; i++) {
      const a = this.rand.range(0, Math.PI * 2);
      const speed = this.rand.range(150, 600);
      this.emit({
        texture: this.textures.spark,
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: this.rand.range(0.3, 0.7),
        tint: 0xffffff,
        scale: this.rand.range(0.6, 1.4),
        scaleEnd: 0,
        drag: 2.2,
        gravity: 300,
      });
    }
  }

  /** Onde circulaire qui s'etend et s'efface. */
  ring(x: number, y: number, tint: number, scale = 1, life = 0.45, alpha = 0.9): void {
    this.emit({
      texture: this.textures.ring,
      x,
      y,
      vx: 0,
      vy: 0,
      life,
      tint,
      scale: scale * 0.25,
      scaleEnd: scale * 1.6,
      alpha,
    });
  }

  /** Flash lumineux tres court. */
  flash(x: number, y: number, tint: number, scale = 1, life = 0.25): void {
    this.emit({
      texture: this.textures.glow,
      x,
      y,
      vx: 0,
      vy: 0,
      life,
      tint,
      scale: scale * 1.2,
      scaleEnd: scale * 2.4,
      alpha: 0.95,
    });
  }

  /** Poussiere de lumiere qui derive lentement (ambiance). */
  mote(x: number, y: number): void {
    this.emit({
      texture: this.textures.spark,
      x,
      y,
      vx: this.rand.range(-12, 12),
      vy: this.rand.range(-28, -8),
      life: this.rand.range(4, 8),
      tint: 0xcfc4ff,
      scale: this.rand.range(0.35, 0.9),
      scaleEnd: 0.1,
      alpha: this.rand.range(0.25, 0.55),
    });
  }

  shake(amplitude: number, durationMs = 220): void {
    if (!this.quality.screenShake) return;
    this.shakeAmp = Math.max(this.shakeAmp, amplitude);
    this.shakeDuration = Math.max(this.shakeDuration, durationMs);
    this.shakeTime = 0;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const t = clamp01(p.life / p.maxLife);
      p.vy += p.gravity * dt;
      if (p.drag > 0) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const s = p.sprite;
      s.position.set(p.x, p.y);
      s.rotation += p.spin * dt;
      s.scale.set(p.scaleStart + (p.scaleEnd - p.scaleStart) * t);
      // Fondu : plein jusqu'a 60 % de la vie, puis disparition.
      s.alpha = t < 0.6 ? p.alphaStart : p.alphaStart * (1 - (t - 0.6) / 0.4);
    }

    if (this.shakeDuration > 0) {
      this.shakeTime += dtMs;
      const k = 1 - clamp01(this.shakeTime / this.shakeDuration);
      if (k <= 0) {
        this.shakeDuration = 0;
        this.shakeAmp = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      } else {
        const a = this.shakeAmp * k * k;
        this.shakeX = (this.rand.next() * 2 - 1) * a;
        this.shakeY = (this.rand.next() * 2 - 1) * a;
      }
    }
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }

  clear(): void {
    for (const p of this.pool) {
      p.active = false;
      p.sprite.visible = false;
    }
    this.shakeDuration = 0;
    this.shakeX = this.shakeY = 0;
  }
}
