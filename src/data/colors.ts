/**
 * Palette des boules : chaque couleur a son identite (nom, teintes) tout en
 * partageant le meme materiau de verre (voir render/textures/ballTexture.ts).
 *
 * V1 : trois couleurs. "amber" et "amethyst" sont pretes pour passer a 4 puis 5
 * couleurs : il suffit de les citer dans `colors` d'un niveau.
 *
 * Accessibilite : `symbol` est reserve a un futur mode ou chaque couleur porte
 * aussi une petite forme gravee (daltonisme). Rien n'y est encore branche.
 */
import type { ColorId } from '@core/model/types';

export interface ColorSpec {
  id: ColorId;
  /** Nom affiche (francais). */
  name: string;
  /** Couleur de base du verre. */
  base: number;
  /** Zone eclairee (haut-gauche). */
  light: number;
  /** Bord et zone profonde. */
  dark: number;
  /** Lueur interne / halo. */
  glow: number;
  /** Teinte CSS pour l'interface DOM. */
  css: string;
  symbol?: 'circle' | 'diamond' | 'triangle' | 'square' | 'star';
}

export const COLORS: Record<string, ColorSpec> = {
  ruby: {
    id: 'ruby',
    name: 'Rubis',
    base: 0xd9214d,
    light: 0xff8aa3,
    dark: 0x5c0a24,
    glow: 0xff3f6e,
    css: '#e0305a',
    symbol: 'diamond',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Saphir',
    base: 0x2263dc,
    light: 0x8fbcff,
    dark: 0x0a2564,
    glow: 0x4a94ff,
    css: '#3a78e8',
    symbol: 'circle',
  },
  emerald: {
    id: 'emerald',
    name: 'Émeraude',
    base: 0x18a865,
    light: 0x8af5bd,
    dark: 0x054d2f,
    glow: 0x3cf09a,
    css: '#25b872',
    symbol: 'triangle',
  },
  amber: {
    id: 'amber',
    name: 'Ambre',
    base: 0xe8961c,
    light: 0xffd98a,
    dark: 0x6e4004,
    glow: 0xffb642,
    css: '#eda02a',
    symbol: 'square',
  },
  amethyst: {
    id: 'amethyst',
    name: 'Améthyste',
    base: 0x8a3fd8,
    light: 0xd9aaff,
    dark: 0x3a0f6e,
    glow: 0xb46cff,
    css: '#9a52e6',
    symbol: 'star',
  },
};

export function colorSpec(id: ColorId): ColorSpec {
  const spec = COLORS[id];
  if (!spec) throw new Error(`Couleur inconnue : ${id}`);
  return spec;
}
