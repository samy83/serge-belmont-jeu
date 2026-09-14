/**
 * Frontieres avec le monde exterieur : social, publicite, synchronisation en
 * ligne. Le coeur du jeu ne connait que ces interfaces ; la V1 branche des
 * implementations "nulles" (rien ne part, rien n'arrive, tout repond
 * proprement). Une integration Facebook, un serveur de classement ou une
 * regie publicitaire se brancheront ici sans toucher au gameplay.
 *
 * DEPENDANCES DE PLATEFORME (documentees, non supposees disponibles) :
 *  - partage / invitations / classement Facebook : necessitent le SDK Instant
 *    Games ou le SDK JS Facebook, un App ID et une validation de l'application ;
 *  - publicite recompensee : necessite une regie (AdMob, Facebook Audience
 *    Network...) et son SDK ; le placement doit exister cote regie ;
 *  - achats integres : necessitent une boutique (Facebook Payments, stores
 *    natifs via Capacitor) et une validation cote serveur.
 */

export interface ShareContent {
  title: string;
  text: string;
  /** URL de l'image (photo debloquee, capture de performance). */
  imageUrl?: string;
  url?: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  isMe?: boolean;
}

export interface SocialProvider {
  readonly name: string;
  /** Vrai si un partage est possible ici (Web Share API, SDK...). */
  canShare(): boolean;
  share(content: ShareContent): Promise<boolean>;
  canInvite(): boolean;
  inviteFriends(message: string): Promise<boolean>;
  getLeaderboard(boardId: string, limit: number): Promise<LeaderboardEntry[]>;
  submitScore(boardId: string, score: number): Promise<boolean>;
}

export type AdKind = 'rewarded' | 'interstitial' | 'banner';

export interface AdsProvider {
  readonly name: string;
  readonly enabled: boolean;
  isAvailable(kind: AdKind): boolean;
  /** Resout true si la recompense est due (visionnage complet). */
  showRewarded(placement: string): Promise<boolean>;
  showInterstitial(placement: string): Promise<void>;
  /** Suppression des publicites (achat) : l'etat vient de la couche achats. */
  adsRemoved(): boolean;
}

export interface PurchaseProvider {
  readonly name: string;
  readonly enabled: boolean;
  listProducts(): Promise<Array<{ id: string; title: string; price: string }>>;
  purchase(productId: string): Promise<boolean>;
  owns(productId: string): boolean;
}

export interface SyncProvider {
  readonly name: string;
  readonly online: boolean;
  /** Pousse la sauvegarde ; ne doit jamais lever (une partie ne se casse pas hors ligne). */
  push(save: unknown): Promise<boolean>;
  pull(): Promise<unknown | null>;
}

export interface PlatformServices {
  social: SocialProvider;
  ads: AdsProvider;
  purchases: PurchaseProvider;
  sync: SyncProvider;
}

/** Partage via l'API Web Share quand elle existe, sinon rien. */
export class WebShareSocialProvider implements SocialProvider {
  readonly name = 'web-share';
  canShare(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }
  async share(content: ShareContent): Promise<boolean> {
    if (!this.canShare()) return false;
    try {
      await navigator.share({ title: content.title, text: content.text, url: content.url });
      return true;
    } catch {
      return false;
    }
  }
  canInvite(): boolean {
    return false;
  }
  async inviteFriends(): Promise<boolean> {
    return false;
  }
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return [];
  }
  async submitScore(): Promise<boolean> {
    return false;
  }
}

export class NullAdsProvider implements AdsProvider {
  readonly name = 'none';
  readonly enabled = false;
  isAvailable(): boolean {
    return false;
  }
  async showRewarded(): Promise<boolean> {
    return false;
  }
  async showInterstitial(): Promise<void> {
    /* rien */
  }
  adsRemoved(): boolean {
    return true;
  }
}

export class NullPurchaseProvider implements PurchaseProvider {
  readonly name = 'none';
  readonly enabled = false;
  async listProducts(): Promise<Array<{ id: string; title: string; price: string }>> {
    return [];
  }
  async purchase(): Promise<boolean> {
    return false;
  }
  owns(): boolean {
    return false;
  }
}

export class OfflineSyncProvider implements SyncProvider {
  readonly name = 'offline';
  get online(): boolean {
    return false;
  }
  async push(): Promise<boolean> {
    return false;
  }
  async pull(): Promise<unknown | null> {
    return null;
  }
}

export function createPlatformServices(): PlatformServices {
  return {
    social: new WebShareSocialProvider(),
    ads: new NullAdsProvider(),
    purchases: new NullPurchaseProvider(),
    sync: new OfflineSyncProvider(),
  };
}
