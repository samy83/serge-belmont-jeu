/**
 * Configuration globale, lue depuis les variables d'environnement Vite
 * (.env, jamais versionne ; voir .env.example). Tout a une valeur par defaut :
 * sans .env, le jeu tourne hors ligne, sans monetisation.
 */
import type { QualityTier } from '@render/quality';

export interface GameConfig {
  /** Prefixe des ressources publiques (photos, audio). Suit `base` de Vite. */
  assetBaseUrl: string;
  monetizationEnabled: boolean;
  facebookAppId: string;
  syncEndpoint: string;
  qualityOverride: QualityTier | 'auto';
  /** Enregistrer le service worker (hors ligne) : seulement en production. */
  serviceWorker: boolean;
  /**
   * Plafond d'un pas de temps (ms) : evite les sauts apres un retour d'onglet.
   * Surchargeable par ?maxframe=1000 (outillage : navigateurs qui brident requestAnimationFrame).
   */
  maxFrameMs: number;
  /** Compteur de cadence a l'ecran (?fps). */
  showFps: boolean;
  version: string;
}

function env(name: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[name];
  return typeof v === 'string' ? v.trim() : '';
}

export function loadConfig(): GameConfig {
  const quality = env('VITE_QUALITY');
  const params = new URLSearchParams(location.search);
  const maxFrame = Number(params.get('maxframe'));
  return {
    maxFrameMs: Number.isFinite(maxFrame) && maxFrame > 0 ? maxFrame : 50,
    showFps: params.has('fps'),
    assetBaseUrl: import.meta.env.BASE_URL || './',
    monetizationEnabled: env('VITE_MONETIZATION') === 'on',
    facebookAppId: env('VITE_FACEBOOK_APP_ID'),
    syncEndpoint: env('VITE_SYNC_ENDPOINT'),
    qualityOverride: quality === 'low' || quality === 'medium' || quality === 'high' ? quality : 'auto',
    serviceWorker: import.meta.env.PROD && !params.has('nosw'),
    version: __APP_VERSION__,
  };
}
