/**
 * Textures fabriquees au lancement avec Canvas 2D (aucun fichier image a
 * charger) : billes de verre, lueurs, eclats, anneaux, pinceau de revelation,
 * velours du fond. Chaque fonction rend un canvas ; `toTexture` en fait une
 * texture PixiJS. Les tailles sont petites (<= 256 px) pour les vieux mobiles.
 */
import { Texture } from 'pixi.js';

export function toTexture(canvas: HTMLCanvasElement): Texture {
  return Texture.from(canvas);
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  return [canvas, ctx];
}

export function hex(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Halo doux (a teinter), pour la lueur sous chaque bille et les flashs. */
export function makeGlowCanvas(size = 128): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Petit point lumineux (etincelles, poussiere de lumiere). */
export function makeSparkCanvas(size = 32): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Eclat de verre : un petit polygone irregulier, clair au centre. */
export function makeShardCanvas(size = 40, seed = 1): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const c = size / 2;
  const n = 3 + (seed % 2);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed * 0.7;
    const r = c * (0.55 + 0.4 * (((seed * 13 + i * 7) % 10) / 10));
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(c * 0.8, c * 0.8, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0.55)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return canvas;
}

/** Anneau d'onde de choc, bords doux. */
export function makeRingCanvas(size = 128): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.72, 'rgba(255,255,255,0)');
  g.addColorStop(0.84, 'rgba(255,255,255,1)');
  g.addColorStop(0.92, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Pinceau de revelation : disque plein a bord doux (efface le voile). */
export function makeBrushCanvas(size = 128, softness = 0.55): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const c = size / 2;
  const hard = Math.max(0, Math.min(0.95, 1 - softness));
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(hard, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/**
 * Le voile : velours nocturne qui cache la photographie. Degrade indigo,
 * lumiere haute, vignette, grain fin et quelques poussieres de lumiere.
 */
export function makeVeilCanvas(w: number, h: number, seed = 7): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(w, h);
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#221a44');
  base.addColorStop(0.5, '#161233');
  base.addColorStop(1, '#0d0b1d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const light = ctx.createRadialGradient(w * 0.5, h * 0.18, 0, w * 0.5, h * 0.18, h * 0.8);
  light.addColorStop(0, 'rgba(110,86,190,0.38)');
  light.addColorStop(0.4, 'rgba(70,50,140,0.14)');
  light.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, h);

  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.25, w * 0.5, h * 0.5, h * 0.85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // Grain fin (pseudo-aleatoire, graine fixe : le fond est le meme a chaque partie).
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 14;
    d[i] = Math.max(0, Math.min(255, d[i]! + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1]! + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2]! + n));
  }
  ctx.putImageData(img, 0, 0);

  // Poussieres de lumiere.
  for (let i = 0; i < 70; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.6 + rand() * 1.8;
    const a = 0.08 + rand() * 0.3;
    ctx.fillStyle = `rgba(230,220,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/** Une case grise : pierre polie a facettes douces, avec un lisere clair en haut. */
export function makeBlockCanvas(w: number, h: number): HTMLCanvasElement {
  const scale = 2;
  const [canvas, ctx] = makeCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
  ctx.scale(scale, scale);
  const r = Math.min(10, h * 0.22);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
  };
  path();
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, '#8d90a2');
  g.addColorStop(0.5, '#5d6070');
  g.addColorStop(1, '#3a3c48');
  ctx.fillStyle = g;
  ctx.fill();
  // Facettes : deux bandes diagonales legerement plus claires.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(w * 0.15, 0);
  ctx.lineTo(w * 0.45, 0);
  ctx.lineTo(w * 0.3, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.moveTo(w * 0.7, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(w * 0.55, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Lisere haut et ombre basse.
  path();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r + 2, 1.5);
  ctx.lineTo(w - r - 2, 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return canvas;
}
