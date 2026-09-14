/**
 * Mini-moteur d'interpolation, pilote par la boucle du jeu (update(dt)) et non
 * par des timers : tout se fige quand la boucle se fige, et tout est
 * annulable. Les promesses rendues permettent d'ecrire les sequences
 * d'animation en async/await, lisibles comme un scenario.
 */

export type Ease = (t: number) => number;

/** Cles de T dont la valeur est un nombre (les seules qu'on peut interpoler). */
export type NumericKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T] & string;

export const Easing = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  /** Depasse la cible puis revient (overshoot). */
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
} as const satisfies Record<string, Ease>;

interface ActiveTween {
  target: Record<string, number>;
  from: Record<string, number>;
  to: Record<string, number>;
  elapsed: number;
  duration: number;
  ease: Ease;
  onUpdate?: (t: number) => void;
  resolve: () => void;
  done: boolean;
}

interface ActiveDelay {
  remaining: number;
  resolve: () => void;
  done: boolean;
}

export class Tweens {
  private tweens: ActiveTween[] = [];
  private delays: ActiveDelay[] = [];

  /** Interpole des proprietes numeriques de `target` vers `to`. */
  to<T extends object>(target: T, to: Partial<Record<NumericKeys<T>, number>>, durationMs: number, ease: Ease = Easing.outQuad, onUpdate?: (t: number) => void): Promise<void> {
    const t = target as unknown as Record<string, number>;
    const from: Record<string, number> = {};
    const dest: Record<string, number> = {};
    for (const k of Object.keys(to)) {
      from[k] = t[k] ?? 0;
      dest[k] = (to as Record<string, number>)[k]!;
    }
    return new Promise<void>((resolve) => {
      if (durationMs <= 0) {
        Object.assign(t, dest);
        onUpdate?.(1);
        resolve();
        return;
      }
      this.tweens.push({ target: t, from, to: dest, elapsed: 0, duration: durationMs, ease, onUpdate, resolve, done: false });
    });
  }

  /** Appelle `fn(t)` pour t de 0 a 1 pendant `durationMs`. */
  run(durationMs: number, fn: (t: number) => void, ease: Ease = Easing.linear): Promise<void> {
    return this.to({}, {}, durationMs, ease, fn);
  }

  delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (ms <= 0) {
        resolve();
        return;
      }
      this.delays.push({ remaining: ms, resolve, done: false });
    });
  }

  update(dtMs: number): void {
    if (this.tweens.length > 0) {
      const list = this.tweens;
      for (const tw of list) {
        if (tw.done) continue;
        tw.elapsed += dtMs;
        const raw = Math.min(1, tw.elapsed / tw.duration);
        const k = tw.ease(raw);
        for (const key of Object.keys(tw.to)) {
          tw.target[key] = tw.from[key]! + (tw.to[key]! - tw.from[key]!) * k;
        }
        tw.onUpdate?.(k);
        if (raw >= 1) {
          tw.done = true;
          tw.resolve();
        }
      }
      this.tweens = list.filter((t) => !t.done);
    }
    if (this.delays.length > 0) {
      const list = this.delays;
      for (const d of list) {
        d.remaining -= dtMs;
        if (d.remaining <= 0) {
          d.done = true;
          d.resolve();
        }
      }
      this.delays = list.filter((d) => !d.done);
    }
  }

  /** Termine tout immediatement (les promesses sont resolues, sans sauter a la fin). */
  killAll(): void {
    for (const t of this.tweens) t.resolve();
    for (const d of this.delays) d.resolve();
    this.tweens = [];
    this.delays = [];
  }

  get count(): number {
    return this.tweens.length + this.delays.length;
  }
}

/** Jeton d'annulation d'une sequence async : on le verifie entre deux etapes. */
export class CancelToken {
  cancelled = false;
  cancel(): void {
    this.cancelled = true;
  }
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
