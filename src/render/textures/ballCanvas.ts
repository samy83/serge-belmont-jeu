/**
 * La bille de verre : la piece maitresse de la direction artistique.
 *
 * Recette (lumiere en haut a gauche, coherente pour toutes les couleurs) :
 *  1. corps : degrade profond, clair vers la lumiere, sombre et sature au fond ;
 *  2. bande sombre au tiers inferieur : reflet d'un environnement sombre,
 *     c'est elle qui donne la "profondeur" du verre ;
 *  3. caustique : la lumiere qui traverse la bille se concentre en bas ;
 *  4. lueur interne coloree ;
 *  5. bord : liseret sombre cote lumiere (epaisseur du verre), liseret clair
 *     a l'oppose (fresnel) ;
 *  6. reflets : sheen large et doux, reflet principal net, eclat ponctuel,
 *     reflet secondaire en arc ;
 *  7. bord a peine translucide.
 */
import type { ColorSpec } from '@data/colors';
import { hex, makeCanvas } from './procedural';

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export function drawGlassBall(spec: ColorSpec, size: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const c = size / 2;
  const R = size * 0.44;

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.clip();

  // 1. Corps.
  const body = ctx.createRadialGradient(c - 0.22 * R, c - 0.28 * R, R * 0.02, c + 0.05 * R, c + 0.1 * R, R * 1.05);
  body.addColorStop(0, hex(mix(spec.light, 0xffffff, 0.18)));
  body.addColorStop(0.22, hex(spec.light));
  body.addColorStop(0.5, hex(spec.base));
  body.addColorStop(0.82, hex(spec.dark));
  body.addColorStop(1, hex(mix(spec.dark, 0x000000, 0.5)));
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, size, size);

  // 2. Bande sombre (reflet de l'environnement) au tiers inferieur.
  const band = ctx.createLinearGradient(0, c + 0.05 * R, 0, c + 0.75 * R);
  band.addColorStop(0, 'rgba(0,0,0,0)');
  band.addColorStop(0.35, 'rgba(0,0,0,0.22)');
  band.addColorStop(0.7, 'rgba(0,0,0,0.16)');
  band.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'lighter';

  // 3. Caustique : lumiere concentree au fond de la bille.
  const caustic = ctx.createRadialGradient(c + 0.08 * R, c + 0.6 * R, 0, c + 0.08 * R, c + 0.6 * R, R * 0.5);
  caustic.addColorStop(0, hex(mix(spec.light, 0xffffff, 0.55), 0.7));
  caustic.addColorStop(0.35, hex(spec.light, 0.28));
  caustic.addColorStop(1, hex(spec.light, 0));
  ctx.fillStyle = caustic;
  ctx.fillRect(0, 0, size, size);

  // 4. Lueur interne.
  const glow = ctx.createRadialGradient(c, c, 0, c, c, R * 0.95);
  glow.addColorStop(0, hex(spec.glow, 0.2));
  glow.addColorStop(0.6, hex(spec.glow, 0.05));
  glow.addColorStop(1, hex(spec.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // 5b. Fresnel : liseret clair a l'oppose de la lumiere.
  const fres = ctx.createRadialGradient(c, c, R * 0.82, c, c, R);
  fres.addColorStop(0, 'rgba(255,255,255,0)');
  fres.addColorStop(0.75, hex(mix(spec.light, 0xffffff, 0.6), 0.28));
  fres.addColorStop(1, hex(mix(spec.light, 0xffffff, 0.8), 0.62));
  ctx.strokeStyle = fres;
  ctx.lineWidth = R * 0.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(c, c, R * 0.93, 0.05, 2.35);
  ctx.stroke();

  // 6a. Sheen large et doux (haut-gauche).
  const sheen = ctx.createRadialGradient(c - 0.3 * R, c - 0.35 * R, 0, c - 0.3 * R, c - 0.35 * R, R * 0.75);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.07)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'source-over';

  // 5a. Epaisseur du verre : liseret sombre cote lumiere.
  const rim = ctx.createRadialGradient(c, c, R * 0.84, c, c, R);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(0.6, 'rgba(0,0,0,0.1)');
  rim.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.strokeStyle = rim;
  ctx.lineWidth = R * 0.16;
  ctx.beginPath();
  ctx.arc(c, c, R * 0.94, 2.6, 5.9);
  ctx.stroke();

  // 6b. Reflet principal : ellipse nette.
  ctx.save();
  ctx.translate(c - 0.4 * R, c - 0.45 * R);
  ctx.rotate(-0.72);
  ctx.scale(1, 0.55);
  const spec1 = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.3);
  spec1.addColorStop(0, 'rgba(255,255,255,1)');
  spec1.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  spec1.addColorStop(0.8, 'rgba(255,255,255,0.25)');
  spec1.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec1;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 6c. Eclat ponctuel.
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.beginPath();
  ctx.arc(c - 0.52 * R, c - 0.57 * R, R * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(c - 0.18 * R, c - 0.68 * R, R * 0.035, 0, Math.PI * 2);
  ctx.fill();

  // 6d. Reflet secondaire : fin arc en bas a droite.
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = R * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(c, c, R * 0.78, 0.35, 1.1);
  ctx.stroke();

  ctx.restore();

  // 7. Bord a peine translucide.
  ctx.globalCompositeOperation = 'destination-in';
  const edge = ctx.createRadialGradient(c, c, R * 0.9, c, c, R);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}
