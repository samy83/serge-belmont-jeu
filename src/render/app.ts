/**
 * L'application PixiJS et le cadrage du plateau logique dans l'ecran.
 *
 * Le plateau (ex. 900 x 1600) est mis a l'echelle pour tenir dans la fenetre
 * en gardant ses proportions, puis centre. Rien ne depend d'une resolution
 * precise : tout le jeu parle en unites logiques, `toLogical()` convertit les
 * coordonnees d'un doigt.
 */
import { Application, Container } from 'pixi.js';
import type { QualityProfile } from './quality';

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
  screenW: number;
  screenH: number;
}

export class GameApp {
  readonly app = new Application();
  /** Conteneur racine du plateau, en unites logiques. */
  readonly world = new Container();
  viewport: Viewport = { scale: 1, offsetX: 0, offsetY: 0, screenW: 1, screenH: 1 };
  private boardW = 900;
  private boardH = 1600;
  /** Espace ecran reserve en haut (HUD), en px CSS. */
  private insetTop = 0;
  private readonly onResize = () => this.layout();

  async init(host: HTMLElement, quality: QualityProfile): Promise<void> {
    const resolution = Math.min(window.devicePixelRatio || 1, quality.maxResolution);
    await this.app.init({
      background: '#0b0a14',
      antialias: false,
      resolution,
      autoDensity: true,
      powerPreference: 'high-performance',
      preference: 'webgl',
      width: window.innerWidth,
      height: window.innerHeight,
    });
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.touchAction = 'none';
    host.appendChild(this.app.canvas);
    this.world.label = 'world';
    this.app.stage.addChild(this.world);
    window.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
    this.layout();
  }

  /** Dimensions logiques du plateau a cadrer. */
  setBoardSize(w: number, h: number): void {
    this.boardW = w;
    this.boardH = h;
    this.layout();
  }

  setInsetTop(px: number): void {
    this.insetTop = px;
    this.layout();
  }

  layout(): void {
    const vv = window.visualViewport;
    const sw = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
    const sh = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
    this.app.renderer.resize(sw, sh);
    const availH = Math.max(1, sh - this.insetTop);
    const scale = Math.min(sw / this.boardW, availH / this.boardH);
    const offsetX = (sw - this.boardW * scale) / 2;
    const offsetY = this.insetTop + (availH - this.boardH * scale) / 2;
    this.viewport = { scale, offsetX, offsetY, screenW: sw, screenH: sh };
    this.world.scale.set(scale);
    this.world.position.set(offsetX, offsetY);
  }

  /** Coordonnees ecran (CSS px) -> unites logiques du plateau. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    const v = this.viewport;
    return {
      x: (clientX - rect.left - v.offsetX) / v.scale,
      y: (clientY - rect.top - v.offsetY) / v.scale,
    };
  }

  /** Rectangle ecran (CSS px) occupe par le plateau, pour caler l'interface DOM. */
  boardScreenRect(): { left: number; top: number; width: number; height: number } {
    const v = this.viewport;
    return { left: v.offsetX, top: v.offsetY, width: this.boardW * v.scale, height: this.boardH * v.scale };
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    this.app.destroy(true, { children: true });
  }
}
