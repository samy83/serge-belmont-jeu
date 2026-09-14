/**
 * La couleur du canon : une sequence cyclique connue d'avance, qui avance a
 * intervalles reguliers. Le joueur voit la couleur actuelle, la suivante, et
 * un signal "changement imminent" pendant les `warningMs` dernieres ms.
 *
 * Deterministe : l'etat ne depend que du temps ecoule (ms) et de la sequence.
 */
import type { ColorId, ColorSequenceDef } from '../model/types';

export class ColorSequencer {
  private elapsed = 0;
  private index: number;
  private changesCount = 0;

  constructor(private readonly def: ColorSequenceDef) {
    if (def.sequence.length === 0) throw new Error('ColorSequencer : sequence vide');
    this.index = ((def.startIndex ?? 0) % def.sequence.length + def.sequence.length) % def.sequence.length;
  }

  /** Avance le temps ; renvoie le nombre de changements de couleur survenus. */
  update(dtMs: number): number {
    if (dtMs <= 0) return 0;
    this.elapsed += dtMs;
    let changes = 0;
    while (this.elapsed >= this.def.intervalMs) {
      this.elapsed -= this.def.intervalMs;
      this.index = (this.index + 1) % this.def.sequence.length;
      changes++;
    }
    this.changesCount += changes;
    return changes;
  }

  get current(): ColorId {
    return this.def.sequence[this.index]!;
  }

  get next(): ColorId {
    return this.def.sequence[(this.index + 1) % this.def.sequence.length]!;
  }

  /** Aperçu des `n` couleurs a venir (sans la couleur actuelle). */
  upcoming(n: number): ColorId[] {
    const out: ColorId[] = [];
    for (let i = 1; i <= n; i++) out.push(this.def.sequence[(this.index + i) % this.def.sequence.length]!);
    return out;
  }

  /** Temps restant avant la prochaine couleur (ms). */
  get timeToChangeMs(): number {
    return this.def.intervalMs - this.elapsed;
  }

  /** Progression 0..1 dans l'intervalle courant. */
  get progress(): number {
    return this.elapsed / this.def.intervalMs;
  }

  /** Vrai pendant la fenetre de signal avant la bascule. */
  get isWarning(): boolean {
    return this.timeToChangeMs <= this.def.warningMs;
  }

  /** Intensite du signal 0..1 (0 hors fenetre, 1 juste avant la bascule). */
  get warningIntensity(): number {
    if (this.def.warningMs <= 0 || !this.isWarning) return 0;
    return 1 - this.timeToChangeMs / this.def.warningMs;
  }

  get totalChanges(): number {
    return this.changesCount;
  }

  /** Force la couleur suivante (utile pour les tests et les futurs boosters). */
  advance(): void {
    this.elapsed = 0;
    this.index = (this.index + 1) % this.def.sequence.length;
    this.changesCount++;
  }
}
