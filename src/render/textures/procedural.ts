/**
 * Textures fabriquees au lancement avec Canvas 2D (aucun fichier image a
 * charger) : billes de verre, lueurs, eclats, anneaux, pinceau de revelation,
 * velours du fond. Chaque fonction rend un canvas ; `toTexture` en fait une
 * texture PixiJS. Les tailles sont petites (<= 256 px) pour les vieux mobiles.
 */
import { Texture } from 'pixi.js';
import type { ColorSpec } from '@data/colors';

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

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/**
 * Une bille de verre : corps en degrade profond, lueur interne, refraction en
 * bas, bord assombri, reflet principal en haut a gauche, eclat net, reflet
 * secondaire, bord legerement translucide. La lumiere vient toujours du haut
 * a gauche : coherence entre toutes les billes.
 */
export function makeBallCanvas(spec: ColorSpec, size = 192): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const c = size / 2;
  const R = size * 0.44;

  // Corps.
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.clip();

  const body = ctx.createRadialGradient(c - 0.3 * R, c - 0.34 * R, R * 0.05, c, c, R * 1.15);
  body.addColorStop(0, hex(mix(spec.light, 0xffffff, 0.25)));
  body.addColorStop(0.28, hex(spec.light));
  body.addColorStop(0.55, hex(spec.base));
  body.addColorStop(0.86, hex(spec.dark));
  body.addColorStop(1, hex(mix(spec.dark, 0x000000, 0.45)));
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, size, size);

  // Lueur interne (le verre garde la lumiere).
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(c, c + 0.05 * R, 0, c, c + 0.05 * R, R * 0.9);
  glow.addColorStop(0, hex(spec.glow, 0.28));
  glow.addColorStop(0.55, hex(spec.glow, 0.08));
  glow.addColorStop(1, hex(spec.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Refraction : croissant lumineux en bas a droite.
  const refr = ctx.createRadialGradient(c + 0.12 * R, c + 0.58 * R, 0, c + 0.12 * R, c + 0.58 * R, R * 0.75);
  refr.addColorStop(0, hex(mix(spec.light, 0xffffff, 0.4), 0.34));
  refr.addColorStop(0.55, hex(spec.light, 0.06));
  refr.addColorStop(1, hex(spec.light, 0));
  ctx.fillStyle = refr;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  // Bord assombri (epaisseur du verre).
  const rim = ctx.createRadialGradient(c, c, R * 0.8, c, c, R);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(0.7, 'rgba(0,0,0,0.12)');
  rim.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);

  // Reflet principal (ellipse douce, haut-gauche).
  ctx.save();
  ctx.translate(c - 0.36 * R, c - 0.44 * R);
  ctx.rotate(-0.6);
  ctx.scale(1, 0.62);
  const spec1 = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.38);
  spec1.addColorStop(0, 'rgba(255,255,255,0.95)');
  spec1.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  spec1.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec1;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Eclat net.
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(c - 0.46 * R, c - 0.52 * R, R * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Reflet secondaire : fin arc en bas a droite.
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = R * 0.055;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(c, c, R * 0.84, 0.15, 1.15);
  ctx.stroke();

  ctx.restore();

  // Bord legerement translucide.
  ctx.globalCompositeOperation = 'destination-in';
  const edge = ctx.createRadialGradient(c, c, R * 0.86, c, c, R);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
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
