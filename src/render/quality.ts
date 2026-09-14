/**
 * Qualite graphique adaptative : trois paliers, choisis au lancement d'apres
 * l'appareil, puis abaisses automatiquement si la cadence chute. Tout ce qui
 * coute (particules, lueurs, resolution) se lit ici, jamais en dur ailleurs.
 */

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualityProfile {
  tier: QualityTier;
  /** Facteur de resolution du canvas (borne le devicePixelRatio). */
  maxResolution: number;
  /** Lueur coloree sous chaque bille. */
  ballGlow: boolean;
  /** Plafond de particules vivantes en meme temps. */
  maxParticles: number;
  shardsPerBall: number;
  sparksPerBounce: number;
  sparksPerBall: number;
  /** Respiration subtile des billes au repos. */
  idleBreathing: boolean;
  /** Poussieres de lumiere qui derivent sur le fond. */
  ambientMotes: number;
  screenShake: boolean;
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  low: {
    tier: 'low',
    maxResolution: 1,
    ballGlow: false,
    maxParticles: 70,
    shardsPerBall: 2,
    sparksPerBounce: 3,
    sparksPerBall: 3,
    idleBreathing: false,
    ambientMotes: 0,
    screenShake: true,
  },
  medium: {
    tier: 'medium',
    maxResolution: 1.5,
    ballGlow: true,
    maxParticles: 180,
    shardsPerBall: 4,
    sparksPerBounce: 5,
    sparksPerBall: 6,
    idleBreathing: true,
    ambientMotes: 8,
    screenShake: true,
  },
  high: {
    tier: 'high',
    maxResolution: 2,
    ballGlow: true,
    maxParticles: 320,
    shardsPerBall: 6,
    sparksPerBounce: 8,
    sparksPerBall: 10,
    idleBreathing: true,
    ambientMotes: 14,
    screenShake: true,
  },
};

/** Devine un palier d'apres ce que le navigateur veut bien dire de l'appareil. */
export function detectQualityTier(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const memory = nav.deviceMemory ?? 4;
  const cores = nav.hardwareConcurrency ?? 4;
  const dpr = window.devicePixelRatio || 1;
  const pixels = window.innerWidth * window.innerHeight * dpr * dpr;
  let score = 0;
  if (memory >= 6) score += 2;
  else if (memory >= 3) score += 1;
  if (cores >= 8) score += 2;
  else if (cores >= 4) score += 1;
  if (pixels > 2_500_000) score -= 1;
  if (score >= 3) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}

export function lowerTier(tier: QualityTier): QualityTier {
  return tier === 'high' ? 'medium' : 'low';
}

/**
 * Surveille la cadence et propose de descendre d'un palier quand la moyenne
 * glissante reste sous `minFps` pendant `windowMs`.
 */
export class FpsMonitor {
  private accumulated = 0;
  private frames = 0;
  private lowStreakMs = 0;

  constructor(
    private readonly minFps = 42,
    private readonly windowMs = 3000,
  ) {}

  /** Renvoie true quand il faudrait baisser la qualite. */
  update(dtMs: number): boolean {
    this.accumulated += dtMs;
    this.frames++;
    if (this.accumulated < 1000) return false;
    const fps = (this.frames * 1000) / this.accumulated;
    this.accumulated = 0;
    this.frames = 0;
    if (fps < this.minFps) {
      this.lowStreakMs += 1000;
      if (this.lowStreakMs >= this.windowMs) {
        this.lowStreakMs = 0;
        return true;
      }
    } else {
      this.lowStreakMs = 0;
    }
    return false;
  }
}
