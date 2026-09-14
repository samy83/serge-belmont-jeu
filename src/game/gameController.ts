/**
 * Le chef d'orchestre : relie le coeur (GameSession), le rendu (LevelView),
 * l'entree (PointerInput), l'interface DOM (Ui), l'audio et la progression.
 * C'est le seul endroit qui connait toutes les couches.
 */
import type { GameConfig } from '@config/gameConfig';
import { GameSession, type ShotResult } from '@core/game/session';
import { loadLevel } from '@core/level/loader';
import type { LevelDef, Vec2 } from '@core/model/types';
import { shotsUntilDowngrade } from '@core/rules/trophies';
import { LEVEL_SOURCES } from '@data/levels';
import { PointerInput } from '../input/pointerInput';
import { AudioService } from '@platform/audio/audioService';
import { createPlatformServices, type PlatformServices } from '@platform/services';
import { createStorage } from '@platform/storage/storage';
import { GameApp } from '@render/app';
import { FpsMonitor, QUALITY_PROFILES, detectQualityTier, lowerTier, type QualityProfile, type QualityTier } from '@render/quality';
import { LevelView, type FxEvent } from '@render/scene/levelView';
import { TextureRegistry } from '@render/textures/registry';
import { CancelToken, Tweens } from '@render/tween';
import { ProgressionStore, type Settings } from '../progression/progressionStore';
import { Ui, type CollectionItemData, type LevelCardData } from '@ui/ui';

const HUD_HEIGHT_PX = 56;

type Phase = 'title' | 'levels' | 'playing' | 'paused' | 'victory' | 'collection' | 'settings';

export class GameController {
  readonly gameApp = new GameApp();
  private readonly tweens = new Tweens();
  private readonly textures = new TextureRegistry();
  private readonly progression: ProgressionStore;
  private readonly audio: AudioService;
  private readonly platform: PlatformServices;
  private readonly levels: LevelDef[];
  private readonly fps = new FpsMonitor();
  private ui!: Ui;
  private input: PointerInput | null = null;
  private quality: QualityProfile;
  private session: GameSession | null = null;
  private view: LevelView | null = null;
  private phase: Phase = 'title';
  private busy = false;
  private playbackToken: CancelToken | null = null;
  private currentLevel: LevelDef | null = null;

  constructor(private readonly config: GameConfig) {
    this.progression = new ProgressionStore(createStorage());
    this.audio = new AudioService(config.assetBaseUrl);
    this.platform = createPlatformServices();
    this.levels = LEVEL_SOURCES.map(loadLevel).sort((a, b) => a.index - b.index);
    this.quality = QUALITY_PROFILES[this.resolveTier()];
  }

  private resolveTier(): QualityTier {
    if (this.config.qualityOverride !== 'auto') return this.config.qualityOverride;
    const s = this.progression.settings.quality;
    return s === 'auto' ? detectQualityTier() : s;
  }

  async start(): Promise<void> {
    const gameHost = document.getElementById('game');
    const uiHost = document.getElementById('ui');
    if (!gameHost || !uiHost) throw new Error('index.html : #game ou #ui manquant');

    await this.gameApp.init(gameHost, this.quality);
    void this.audio.loadManifest().then(() => this.audio.preload());
    this.applyVolumes();

    this.ui = new Ui(
      uiHost,
      {
        play: () => this.onPlay(),
        openLevels: () => this.showLevels(),
        openCollection: () => this.showCollection(),
        openSettings: () => this.showSettings(),
        backToTitle: () => this.showTitle(),
        startLevel: (id) => void this.startLevel(id),
        pause: () => this.pause(),
        resume: () => this.resume(),
        restart: () => void this.restart(),
        quitToLevels: () => this.quitToLevels(),
        nextLevel: () => void this.nextLevel(),
        share: (id) => void this.share(id),
        setVolume: (kind, v) => this.setVolume(kind, v),
        setQuality: (q) => this.setQuality(q),
        resetProgress: () => this.progression.reset(),
        userGesture: () => this.audio.unlock(),
      },
      {
        levels: () => this.levelCards(),
        collection: () => this.collectionItems(),
        settings: () => this.progression.settings,
        canShare: () => this.platform.social.canShare(),
        version: this.config.version,
      },
    );

    // Le ticker de Pixi plafonne lui aussi le pas (1000 / minFPS, soit 100 ms par defaut) : on aligne les deux plafonds.
    this.gameApp.app.ticker.minFPS = Math.min(10, 1000 / this.config.maxFrameMs);
    this.gameApp.app.ticker.add((ticker) => this.loop(Math.min(this.config.maxFrameMs, ticker.deltaMS)));
    this.showTitle();
  }

  // ----- Boucle -----

  private loop(dtMs: number): void {
    if (this.phase === 'paused') return;
    this.tweens.update(dtMs);
    if (this.session && this.view && (this.phase === 'playing' || this.phase === 'victory')) {
      this.session.update(dtMs, this.busy);
      this.view.update(dtMs);
      if (this.phase === 'playing' && this.fps.update(dtMs) && this.quality.tier !== 'low') {
        this.quality = QUALITY_PROFILES[lowerTier(this.quality.tier)];
        this.view.setQuality(this.quality);
        console.info(`[qualite] cadence faible : passage en ${this.quality.tier}`);
      }
    }
  }

  // ----- Navigation -----

  private showTitle(): void {
    this.phase = 'title';
    this.leaveLevel();
    this.ui.showTitle(this.progression.snapshot.stats.levelsCompleted > 0);
  }

  private onPlay(): void {
    this.audio.play('ui');
    // Reprendre au premier niveau non termine.
    const next = this.levels.find((l) => !this.progression.level(l.id).completed) ?? this.levels[0]!;
    if (this.progression.snapshot.stats.levelsCompleted === 0) void this.startLevel(next.id);
    else this.showLevels();
  }

  private showLevels(): void {
    this.phase = 'levels';
    this.leaveLevel();
    this.ui.showLevels();
  }

  private showCollection(): void {
    this.audio.play('ui');
    this.phase = 'collection';
    this.leaveLevel();
    this.ui.showCollection();
  }

  private showSettings(): void {
    this.audio.play('ui');
    this.phase = 'settings';
    this.leaveLevel();
    this.ui.showSettings();
  }

  private levelCards(): LevelCardData[] {
    const ids = this.levels.map((l) => l.id);
    return this.levels.map((l) => {
      const p = this.progression.level(l.id);
      return {
        id: l.id,
        index: l.index,
        name: l.name,
        unlocked: this.progression.isUnlocked(l.index, ids),
        completed: p.completed,
        trophy: p.trophy,
        bestShots: p.bestShots,
      };
    });
  }

  private collectionItems(): CollectionItemData[] {
    return this.levels.map((l) => ({
      id: l.id,
      index: l.index,
      title: l.photo.title ?? l.name,
      photoUrl: this.config.assetBaseUrl + l.photo.src,
      unlocked: this.progression.hasPhoto(l.id),
    }));
  }

  // ----- Niveau -----

  private leaveLevel(): void {
    this.playbackToken?.cancel();
    this.playbackToken = null;
    this.tweens.killAll();
    this.input?.cancel();
    this.ui.hideHud();
    if (this.view) {
      this.gameApp.world.removeChild(this.view.root);
      this.view.destroy();
      this.view = null;
    }
    this.session = null;
    this.currentLevel = null;
    this.busy = false;
  }

  async startLevel(id: string): Promise<void> {
    const level = this.levels.find((l) => l.id === id);
    if (!level) return;
    this.audio.play('ui');
    this.leaveLevel();
    this.ui.closeScreen();
    this.currentLevel = level;
    this.session = new GameSession(level);
    this.view = new LevelView(this.gameApp.app.renderer, this.session, this.textures, this.quality, this.tweens, (e) => this.onFx(e));
    this.gameApp.world.addChild(this.view.root);
    this.gameApp.setBoardSize(level.board.width, level.board.height);
    this.gameApp.setInsetTop(HUD_HEIGHT_PX);
    this.ensureInput();
    this.phase = 'playing';
    this.ui.showHud(level.index, level.name);
    this.refreshHud();
    this.progression.recordPlay(level.id);
    await this.view.init(this.config.assetBaseUrl);
  }

  private ensureInput(): void {
    if (this.input) return;
    // Le premier contact avec le canvas deverrouille l'audio (exigence des navigateurs mobiles).
    this.gameApp.app.canvas.addEventListener('pointerdown', () => this.audio.unlock(), { passive: true });
    this.input = new PointerInput(this.gameApp.app.canvas, {
      toLogical: (x, y) => this.gameApp.toLogical(x, y),
      aimAt: (p) => this.session?.aimDirection(p.x, p.y) ?? null,
      canInteract: () => this.phase === 'playing' && !this.busy && this.session?.state === 'playing',
      cannonMovable: () => this.session?.level.cannon.movable ?? false,
      cannonX: () => this.session?.cannonX ?? 0,
      bandTop: () => (this.session ? this.session.level.board.floorY + 60 : Infinity),
      onAim: (dir) => this.view?.setAim(dir),
      onFire: (dir) => void this.fire(dir),
      onMoveCannon: (x) => this.session?.setCannonX(x),
    });
  }

  private async fire(dir: Vec2): Promise<void> {
    if (!this.session || !this.view || this.busy || this.phase !== 'playing') return;
    this.audio.unlock();
    this.busy = true;
    const shot: ShotResult = this.session.fire(dir);
    this.refreshHud();
    const token = new CancelToken();
    this.playbackToken = token;
    try {
      await this.view.playShot(shot, token);
    } finally {
      if (this.playbackToken === token) this.playbackToken = null;
    }
    if (token.cancelled) return;
    this.busy = false;
    if (shot.won) this.onWin();
  }

  private refreshHud(): void {
    if (!this.session) return;
    const t = shotsUntilDowngrade(this.session.level.trophies, this.session.shots);
    this.ui.updateHud({ shots: this.session.shots, tier: t.tier, remaining: t.remaining, nextThreshold: t.tier === 'none' ? null : t.remaining });
  }

  private onWin(): void {
    if (!this.session || !this.currentLevel) return;
    this.phase = 'victory';
    const level = this.currentLevel;
    const result = this.session.result();
    const trophy = this.session.trophy();
    const news = this.progression.recordWin(level.id, result, trophy);
    const next = this.levels.find((l) => l.index === level.index + 1);
    this.ui.hideHud();
    this.ui.showVictory({
      levelId: level.id,
      levelName: level.name,
      photoUrl: this.config.assetBaseUrl + level.photo.src,
      photoTitle: level.photo.title ?? level.name,
      photoCredit: level.photo.credit,
      trophy,
      shots: result.shots,
      timeMs: result.timeMs,
      maxChain: result.maxChain,
      newBest: news.newBest,
      newTrophy: news.newTrophy,
      newPhoto: news.newPhoto,
      hasNext: next !== undefined,
      goldThreshold: level.trophies.gold,
    });
  }

  private pause(): void {
    if (this.phase !== 'playing') return;
    this.audio.play('ui');
    this.input?.cancel();
    this.phase = 'paused';
    this.ui.showPause();
  }

  private resume(): void {
    if (this.phase !== 'paused') return;
    this.audio.play('ui');
    this.ui.closeScreen();
    this.phase = 'playing';
  }

  private async restart(): Promise<void> {
    const id = this.currentLevel?.id;
    if (id) await this.startLevel(id);
  }

  private quitToLevels(): void {
    this.audio.play('ui');
    this.showLevels();
  }

  private async nextLevel(): Promise<void> {
    const cur = this.currentLevel;
    const next = cur ? this.levels.find((l) => l.index === cur.index + 1) : undefined;
    if (next) await this.startLevel(next.id);
    else this.showLevels();
  }

  private async share(levelId: string): Promise<void> {
    const level = this.levels.find((l) => l.id === levelId);
    if (!level) return;
    const p = this.progression.level(levelId);
    const ok = await this.platform.social.share({
      title: 'Serge Belmont',
      text: `J’ai révélé « ${level.photo.title ?? level.name} » en ${p.bestShots ?? '?'} tirs. À vous de jouer !`,
      url: location.href,
    });
    if (!ok) this.ui.toast('Partage indisponible sur cet appareil');
  }

  // ----- Reglages -----

  private applyVolumes(): void {
    const s = this.progression.settings;
    this.audio.setVolumes({ master: s.masterVolume, music: s.musicVolume, sfx: s.sfxVolume });
  }

  private setVolume(kind: 'master' | 'music' | 'sfx', v: number): void {
    const patch: Partial<Settings> = kind === 'master' ? { masterVolume: v } : kind === 'music' ? { musicVolume: v } : { sfxVolume: v };
    this.progression.updateSettings(patch);
    this.applyVolumes();
    if (kind !== 'music') this.audio.play('ui');
  }

  private setQuality(q: Settings['quality']): void {
    this.progression.updateSettings({ quality: q });
    this.quality = QUALITY_PROFILES[this.resolveTier()];
    this.view?.setQuality(this.quality);
  }

  // ----- Audio des evenements de jeu -----

  private onFx(e: FxEvent): void {
    switch (e.type) {
      case 'shoot':
        this.audio.play('shoot');
        break;
      case 'bounce':
        this.audio.play(e.surface === 'obstacle' ? 'bounceObstacle' : 'bounce', { pitch: 0.95 + Math.random() * 0.1 });
        break;
      case 'attach':
        this.audio.play('attach');
        break;
      case 'lost':
        this.audio.play('lost');
        break;
      case 'crack':
        this.audio.play('crack', { volume: 0.6 + Math.min(0.4, e.size * 0.08) });
        break;
      case 'explode':
        this.audio.play('explode', { pitch: 1 + Math.min(6, e.size - 3) * 0.05 + e.chain * 0.1, volume: Math.min(1.2, 0.8 + e.size * 0.06) });
        if (e.chain >= 1) this.audio.play('cascade', { pitch: 1 + e.chain * 0.12 });
        break;
      case 'reveal':
        this.audio.play('reveal', { volume: 0.7 });
        break;
      case 'land':
        this.audio.play('land');
        break;
      case 'drop':
        this.audio.play('drop', { volume: Math.min(1, 0.6 + e.count * 0.1) });
        break;
      case 'colorChange':
        this.audio.play('colorChange');
        break;
      case 'win':
        this.audio.play('win');
        break;
      default:
        break;
    }
  }
}
