/**
 * Trophees : la performance se juge d'abord au nombre de tirs (le joueur
 * attend parfois la bonne couleur, le temps serait injuste). Les seuils
 * viennent du niveau, jamais du code. D'autres criteres pourront s'ajouter en
 * etendant `LevelResult` et `TrophyDef.metric`.
 */
import type { TrophyDef, TrophyTier } from '../model/types';

export interface LevelResult {
  shots: number;
  timeMs: number;
  matches: number;
  maxChain: number;
  ballsMatched: number;
  ballsDropped: number;
}

export const TROPHY_ORDER: TrophyTier[] = ['none', 'bronze', 'silver', 'gold'];

export function evaluateTrophy(def: TrophyDef, result: LevelResult): TrophyTier {
  const value = metricValue(def.metric, result);
  if (value <= def.gold) return 'gold';
  if (value <= def.silver) return 'silver';
  if (value <= def.bronze) return 'bronze';
  return 'none';
}

export function metricValue(metric: TrophyDef['metric'], result: LevelResult): number {
  switch (metric) {
    case 'shots':
      return result.shots;
    default:
      return result.shots;
  }
}

/** Le meilleur des deux trophees (pour la progression sauvegardee). */
export function bestTrophy(a: TrophyTier, b: TrophyTier): TrophyTier {
  return TROPHY_ORDER.indexOf(a) >= TROPHY_ORDER.indexOf(b) ? a : b;
}

/** Combien de tirs restent avant de perdre le palier courant (pour le HUD). */
export function shotsUntilDowngrade(def: TrophyDef, shots: number): { tier: TrophyTier; remaining: number } {
  if (shots <= def.gold) return { tier: 'gold', remaining: def.gold - shots };
  if (shots <= def.silver) return { tier: 'silver', remaining: def.silver - shots };
  if (shots <= def.bronze) return { tier: 'bronze', remaining: def.bronze - shots };
  return { tier: 'none', remaining: 0 };
}
