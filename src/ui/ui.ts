/**
 * Interface DOM : ecrans (titre, niveaux, pause, victoire, collection,
 * reglages) et HUD. Elle ne connait pas le moteur : elle recoit des donnees a
 * afficher et rappelle des actions nommees. Tout le style est dans styles.css.
 */
import type { TrophyTier } from '@core/model/types';
import type { Settings } from '../progression/progressionStore';

export interface LevelCardData {
  id: string;
  index: number;
  name: string;
  unlocked: boolean;
  completed: boolean;
  trophy: TrophyTier;
  bestShots: number | null;
}

export interface CollectionItemData {
  id: string;
  index: number;
  title: string;
  photoUrl: string;
  unlocked: boolean;
}

export interface VictoryData {
  levelId: string;
  levelName: string;
  photoUrl: string;
  photoTitle: string;
  photoCredit?: string;
  trophy: TrophyTier;
  shots: number;
  timeMs: number;
  maxChain: number;
  newBest: boolean;
  newTrophy: boolean;
  newPhoto: boolean;
  hasNext: boolean;
  goldThreshold: number;
}

export interface HudState {
  shots: number;
  tier: TrophyTier;
  remaining: number;
  nextThreshold: number | null;
}

export interface UiActions {
  play(): void;
  openLevels(): void;
  openCollection(): void;
  openSettings(): void;
  backToTitle(): void;
  startLevel(id: string): void;
  pause(): void;
  resume(): void;
  restart(): void;
  quitToLevels(): void;
  nextLevel(): void;
  share(levelId: string): void;
  setVolume(kind: 'master' | 'music' | 'sfx', value: number): void;
  setQuality(q: Settings['quality']): void;
  resetProgress(): void;
  /** Un geste utilisateur vient d'avoir lieu (deverrouillage audio). */
  userGesture(): void;
}

export interface UiData {
  levels(): LevelCardData[];
  collection(): CollectionItemData[];
  settings(): Settings;
  canShare(): boolean;
  version: string;
}

const TIER_LABEL: Record<TrophyTier, string> = { gold: 'Or', silver: 'Argent', bronze: 'Bronze', none: '—' };

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function gem(tier: TrophyTier): string {
  return `<span class="gem ${tier}">◆</span>`;
}

function formatTime(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, '0')}` : `${s} s`;
}

export class Ui {
  private readonly root: HTMLElement;
  private screen: HTMLElement | null = null;
  private hud: HTMLElement | null = null;
  private hudShots: HTMLElement | null = null;
  private hudTrophy: HTMLElement | null = null;
  private lastShots = -1;

  constructor(
    root: HTMLElement,
    private readonly actions: UiActions,
    private readonly data: UiData,
  ) {
    this.root = root;
    root.addEventListener('pointerdown', () => actions.userGesture(), { passive: true });
  }

  private mount(html: string, className = 'screen'): HTMLElement {
    this.closeScreen();
    const el = document.createElement('div');
    el.className = className;
    el.innerHTML = html;
    this.root.appendChild(el);
    this.screen = el;
    return el;
  }

  closeScreen(): void {
    this.screen?.remove();
    this.screen = null;
  }

  /** Delegation : chaque [data-action] declenche l'action nommee. */
  private bind(el: HTMLElement, handlers: Record<string, (target: HTMLElement) => void>): void {
    el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!t || t.hasAttribute('disabled')) return;
      const fn = handlers[t.dataset.action ?? ''];
      if (fn) {
        e.preventDefault();
        fn(t);
      }
    });
  }

  showTitle(hasProgress: boolean): void {
    const el = this.mount(`
      <h1 class="title"><small>un jeu de billes de cristal</small>Serge Belmont</h1>
      <p class="subtitle">Chaque niveau cache une photographie.<br>Brisez le verre, révélez le souvenir.</p>
      <div class="ornament"></div>
      <div class="stack">
        <button class="btn primary" data-action="play">${hasProgress ? 'Continuer' : 'Jouer'}</button>
        <div class="btn-row">
          <button class="btn small" data-action="collection">Collection</button>
          <button class="btn small" data-action="settings">Réglages</button>
        </div>
      </div>
      <div class="footer">Prototype v${esc(this.data.version)}</div>
    `);
    this.bind(el, {
      play: () => this.actions.play(),
      collection: () => this.actions.openCollection(),
      settings: () => this.actions.openSettings(),
    });
  }

  showLevels(): void {
    const cards = this.data
      .levels()
      .map((l) => {
        const meta = l.completed ? `${gem(l.trophy)}${l.bestShots ?? '—'} tirs` : l.unlocked ? 'à jouer' : 'verrouillé';
        return `<button class="level-card${l.unlocked ? '' : ' locked'}" data-action="level" data-id="${esc(l.id)}" ${l.unlocked ? '' : 'disabled'}>
          <span class="num">${l.index}</span>
          <span class="name">${esc(l.name)}</span>
          <span class="meta">${meta}</span>
        </button>`;
      })
      .join('');
    const el = this.mount(`
      <div class="screen-header">
        <button class="icon-btn" data-action="back" aria-label="Retour">←</button>
        <h2>Niveaux</h2>
        <span style="width:44px"></span>
      </div>
      <div class="levels-grid">${cards}</div>
      <p class="hint">Moins de tirs, plus beau trophée. Attendez la bonne couleur : elle est annoncée.</p>
    `);
    this.bind(el, {
      back: () => this.actions.backToTitle(),
      level: (t) => this.actions.startLevel(t.dataset.id ?? ''),
    });
  }

  showHud(levelIndex: number, levelName: string): void {
    this.hideHud();
    const el = document.createElement('div');
    el.className = 'hud';
    el.innerHTML = `
      <div class="hud-level"><span>Niveau ${levelIndex}</span>${esc(levelName)}</div>
      <div class="hud-shots"><b>0</b><span>tirs</span></div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="hud-trophy"></div>
        <button class="icon-btn" data-action="pause" aria-label="Menu">≡</button>
      </div>`;
    this.root.appendChild(el);
    this.hud = el;
    this.hudShots = el.querySelector('.hud-shots b');
    this.hudTrophy = el.querySelector('.hud-trophy');
    this.lastShots = -1;
    this.bind(el, { pause: () => this.actions.pause() });
  }

  updateHud(state: HudState): void {
    if (!this.hudShots || !this.hudTrophy) return;
    if (state.shots !== this.lastShots) {
      this.hudShots.textContent = String(state.shots);
      this.hudShots.classList.remove('bump');
      void this.hudShots.offsetWidth;
      this.hudShots.classList.add('bump');
      this.lastShots = state.shots;
    }
    if (state.tier === 'none') {
      this.hudTrophy.innerHTML = `${gem('none')}<b>sans trophée</b>`;
    } else {
      const hint = state.remaining === 0 ? 'à la limite' : `encore ${state.remaining} tir${state.remaining > 1 ? 's' : ''}`;
      this.hudTrophy.innerHTML = `${gem(state.tier)}${TIER_LABEL[state.tier]}<b>${hint}</b>`;
    }
  }

  hideHud(): void {
    this.hud?.remove();
    this.hud = null;
    this.hudShots = null;
    this.hudTrophy = null;
  }

  showPause(): void {
    const el = this.mount(
      `
      <h2 class="victory-title">Pause</h2>
      <div class="ornament"></div>
      <div class="stack">
        <button class="btn primary" data-action="resume">Reprendre</button>
        <button class="btn" data-action="restart">Recommencer</button>
        <button class="btn ghost" data-action="quit">Niveaux</button>
      </div>
      ${this.volumeControls()}
    `,
      'screen is-transparent',
    );
    this.bind(el, {
      resume: () => this.actions.resume(),
      restart: () => this.actions.restart(),
      quit: () => this.actions.quitToLevels(),
    });
    this.bindVolumes(el);
  }

  showVictory(v: VictoryData): void {
    const badges = [v.newPhoto ? 'Photo ajoutée' : '', v.newBest ? 'Record de tirs' : '', v.newTrophy ? 'Nouveau trophée' : '']
      .filter(Boolean)
      .map((b) => `<span class="badge">${b}</span>`)
      .join('');
    const el = this.mount(`
      <div class="photo-frame"><img src="${esc(v.photoUrl)}" alt="${esc(v.photoTitle)}"></div>
      <h2 class="victory-title">Révélé</h2>
      <p class="photo-caption">${esc(v.photoTitle)}${v.photoCredit ? ` <span style="opacity:.6;font-size:.8em">— ${esc(v.photoCredit)}</span>` : ''}</p>
      <div class="trophy-big">${gem(v.trophy)}${v.trophy === 'none' ? 'Sans trophée' : `Trophée ${TIER_LABEL[v.trophy]}`}</div>
      <div class="stats">
        <div><b>${v.shots}</b><span>tirs</span></div>
        <div><b>${formatTime(v.timeMs)}</b><span>temps</span></div>
        <div><b>${v.maxChain}</b><span>cascade</span></div>
      </div>
      <div>${badges}</div>
      <div class="stack">
        ${v.hasNext ? '<button class="btn primary" data-action="next">Niveau suivant</button>' : '<button class="btn primary" data-action="levels">Tous les niveaux</button>'}
        <div class="btn-row">
          <button class="btn small" data-action="restart">Rejouer</button>
          <button class="btn small" data-action="collection">Collection</button>
          ${this.data.canShare() ? '<button class="btn small" data-action="share">Partager</button>' : ''}
        </div>
      </div>
    `);
    this.bind(el, {
      next: () => this.actions.nextLevel(),
      levels: () => this.actions.quitToLevels(),
      restart: () => this.actions.restart(),
      collection: () => this.actions.openCollection(),
      share: () => this.actions.share(v.levelId),
    });
  }

  showCollection(): void {
    const items = this.data
      .collection()
      .map((c) =>
        c.unlocked
          ? `<button class="collection-item" data-action="open" data-id="${esc(c.id)}"><img src="${esc(c.photoUrl)}" alt="${esc(c.title)}" loading="lazy"><span class="label">${esc(c.title)}</span></button>`
          : `<div class="collection-item"><span class="lock">?</span><span class="label">Niveau ${c.index}</span></div>`,
      )
      .join('');
    const count = this.data.collection().filter((c) => c.unlocked).length;
    const el = this.mount(`
      <div class="screen-header">
        <button class="icon-btn" data-action="back" aria-label="Retour">←</button>
        <h2>Collection</h2>
        <span style="width:44px"></span>
      </div>
      <p class="hint" style="margin:0 0 10px">${count} photographie${count > 1 ? 's' : ''} sur ${this.data.collection().length}</p>
      <div class="collection-grid">${items}</div>
    `);
    this.bind(el, {
      back: () => this.actions.backToTitle(),
      open: (t) => {
        const item = this.data.collection().find((c) => c.id === t.dataset.id);
        if (item) this.showLightbox(el, item);
      },
    });
  }

  private showLightbox(parent: HTMLElement, item: CollectionItemData): void {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = `
      <div class="photo-frame"><img src="${esc(item.photoUrl)}" alt="${esc(item.title)}"></div>
      <p class="photo-caption">${esc(item.title)}</p>
      <div class="btn-row">
        ${this.data.canShare() ? `<button class="btn small" data-action="share">Partager</button>` : ''}
        <button class="btn small ghost" data-action="close">Fermer</button>
      </div>`;
    parent.appendChild(box);
    this.bind(box, {
      close: () => box.remove(),
      share: () => this.actions.share(item.id),
    });
  }

  private volumeControls(): string {
    const s = this.data.settings();
    const slider = (kind: string, label: string, value: number) => `
      <div class="setting">
        <label>${label}<span>${Math.round(value * 100)} %</span></label>
        <input type="range" min="0" max="100" value="${Math.round(value * 100)}" data-volume="${kind}">
      </div>`;
    return `<div class="settings" style="margin-top:22px">
      ${slider('master', 'Volume général', s.masterVolume)}
      ${slider('music', 'Musique', s.musicVolume)}
      ${slider('sfx', 'Effets', s.sfxVolume)}
    </div>`;
  }

  private bindVolumes(el: HTMLElement): void {
    el.querySelectorAll<HTMLInputElement>('input[data-volume]').forEach((input) => {
      input.addEventListener('input', () => {
        const v = Number(input.value) / 100;
        const label = input.previousElementSibling?.querySelector('span');
        if (label) label.textContent = `${input.value} %`;
        this.actions.setVolume(input.dataset.volume as 'master' | 'music' | 'sfx', v);
      });
    });
  }

  showSettings(): void {
    const s = this.data.settings();
    const el = this.mount(`
      <div class="screen-header">
        <button class="icon-btn" data-action="back" aria-label="Retour">←</button>
        <h2>Réglages</h2>
        <span style="width:44px"></span>
      </div>
      ${this.volumeControls()}
      <div class="settings">
        <div class="setting">
          <label>Qualité graphique</label>
          <select data-quality>
            <option value="auto"${s.quality === 'auto' ? ' selected' : ''}>Automatique</option>
            <option value="high"${s.quality === 'high' ? ' selected' : ''}>Haute</option>
            <option value="medium"${s.quality === 'medium' ? ' selected' : ''}>Moyenne</option>
            <option value="low"${s.quality === 'low' ? ' selected' : ''}>Basse (téléphones anciens)</option>
          </select>
        </div>
        <button class="btn ghost small" data-action="reset">Effacer la progression</button>
      </div>
      <div class="footer">Prototype v${esc(this.data.version)}</div>
    `);
    this.bind(el, {
      back: () => this.actions.backToTitle(),
      reset: (t) => {
        if (t.dataset.confirm === '1') {
          this.actions.resetProgress();
          t.textContent = 'Progression effacée';
          t.setAttribute('disabled', '');
        } else {
          t.dataset.confirm = '1';
          t.textContent = 'Confirmer l’effacement ?';
        }
      },
    });
    this.bindVolumes(el);
    el.querySelector<HTMLSelectElement>('select[data-quality]')?.addEventListener('change', (e) => {
      this.actions.setQuality((e.target as HTMLSelectElement).value as Settings['quality']);
    });
  }

  /** Banniere d'entree de niveau : le nom, puis l'objectif, qui s'efface seule. */
  banner(title: string, subtitle: string): void {
    this.root.querySelector('.banner')?.remove();
    const b = document.createElement('div');
    b.className = 'banner';
    b.innerHTML = `<div class="banner-title">${esc(title)}</div><div class="banner-sub">${esc(subtitle)}</div>`;
    this.root.appendChild(b);
    setTimeout(() => b.remove(), 2400);
  }

  toast(text: string): void {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    this.root.appendChild(t);
    setTimeout(() => t.remove(), 3100);
  }
}
