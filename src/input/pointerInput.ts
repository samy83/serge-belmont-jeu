/**
 * Le doigt : sous le cadre on deplace le canon, dans le cadre on vise, et on
 * tire en relachant. Redescendre le doigt sous le cadre pendant la visee
 * annule le tir. Un seul pointeur est suivi (le premier pose).
 *
 * Cette couche ne connait ni Pixi ni la logique : elle traduit des evenements
 * ecran en intentions (viser, tirer, deplacer) en unites logiques du plateau.
 */
import type { Vec2 } from '@core/model/types';

export interface PointerHandlers {
  /** Coordonnees ecran -> plateau. */
  toLogical(clientX: number, clientY: number): Vec2;
  /** Direction de tir pour un point du plateau (null = point invalide). */
  aimAt(p: Vec2): Vec2 | null;
  /** Le jeu accepte-t-il une action en ce moment ? */
  canInteract(): boolean;
  cannonMovable(): boolean;
  cannonX(): number;
  /** Ordonnee (plateau) au-dessous de laquelle le doigt deplace le canon. */
  bandTop(): number;
  onAim(dir: Vec2 | null): void;
  onFire(dir: Vec2): void;
  onMoveCannon(x: number): void;
}

type Mode = 'idle' | 'aim' | 'move';

export class PointerInput {
  private mode: Mode = 'idle';
  private pointerId: number | null = null;
  private lastDir: Vec2 | null = null;
  private grabOffset = 0;

  constructor(
    private readonly target: HTMLElement,
    private readonly h: PointerHandlers,
  ) {
    target.addEventListener('pointerdown', this.onDown, { passive: false });
    target.addEventListener('pointermove', this.onMove, { passive: false });
    target.addEventListener('pointerup', this.onUp, { passive: false });
    target.addEventListener('pointercancel', this.onCancel, { passive: false });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  destroy(): void {
    this.target.removeEventListener('pointerdown', this.onDown);
    this.target.removeEventListener('pointermove', this.onMove);
    this.target.removeEventListener('pointerup', this.onUp);
    this.target.removeEventListener('pointercancel', this.onCancel);
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null || !this.h.canInteract()) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.target.setPointerCapture(e.pointerId);
    } catch {
      /* certains navigateurs refusent la capture : sans gravite */
    }
    const p = this.h.toLogical(e.clientX, e.clientY);
    if (p.y > this.h.bandTop() && this.h.cannonMovable()) {
      this.mode = 'move';
      this.grabOffset = this.h.cannonX() - p.x;
      return;
    }
    this.mode = 'aim';
    this.updateAim(p);
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const p = this.h.toLogical(e.clientX, e.clientY);
    if (this.mode === 'move') {
      this.h.onMoveCannon(p.x + this.grabOffset);
    } else if (this.mode === 'aim') {
      this.updateAim(p);
    }
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    if (this.mode === 'aim') {
      const p = this.h.toLogical(e.clientX, e.clientY);
      this.updateAim(p);
      if (this.lastDir && this.h.canInteract()) this.h.onFire(this.lastDir);
      this.h.onAim(null);
    }
    this.reset();
  };

  private readonly onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    if (this.mode === 'aim') this.h.onAim(null);
    this.reset();
  };

  private updateAim(p: Vec2): void {
    if (p.y > this.h.bandTop()) {
      // Zone d'annulation : la ligne de visee disparait, relacher ne tire pas.
      this.lastDir = null;
      this.h.onAim(null);
      return;
    }
    const dir = this.h.aimAt(p);
    this.lastDir = dir;
    this.h.onAim(dir);
  }

  private reset(): void {
    if (this.pointerId !== null) {
      try {
        this.target.releasePointerCapture(this.pointerId);
      } catch {
        /* deja relache */
      }
    }
    this.pointerId = null;
    this.mode = 'idle';
    this.lastDir = null;
  }

  /** Annule toute interaction en cours (ex. : le jeu passe en animation). */
  cancel(): void {
    if (this.mode === 'aim') this.h.onAim(null);
    this.reset();
  }
}
