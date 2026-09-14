/**
 * Sons de synthese (Web Audio) : la V1 n'a pas encore de fichiers audio, mais
 * le jeu sonne quand meme, dans une matiere de verre et de cristal. Chaque
 * recette est nommee ; le manifeste (public/audio/manifest.json) peut la
 * remplacer par un fichier sans toucher au code.
 */

export type SynthKind =
  | 'shoot'
  | 'bounce'
  | 'bounceObstacle'
  | 'attach'
  | 'crack'
  | 'explode'
  | 'cascade'
  | 'reveal'
  | 'drop'
  | 'land'
  | 'colorChange'
  | 'win'
  | 'ui'
  | 'lost';

export interface SynthOptions {
  /** 1 = hauteur de reference. */
  pitch?: number;
  volume?: number;
}

let noiseBuffer: AudioBuffer | null = null;

function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    d[i] = s / 2147483648 - 1;
  }
  noiseBuffer = buf;
  return buf;
}

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  at: number,
  f0: number,
  f1: number,
  dur: number,
  gain: number,
  type: OscillatorType = 'sine',
  attack = 0.004,
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, f0), at);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function noise(
  ctx: AudioContext,
  dest: AudioNode,
  at: number,
  dur: number,
  gain: number,
  filterType: BiquadFilterType,
  freq: number,
  q = 1,
  freqEnd?: number,
): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(freq, at);
  if (freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), at + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(at);
  src.stop(at + dur + 0.02);
}

/** Joue une recette de synthese. `dest` est le bus (effets ou musique). */
export function playSynth(ctx: AudioContext, dest: AudioNode, kind: SynthKind, opts: SynthOptions = {}): void {
  const p = opts.pitch ?? 1;
  const v = opts.volume ?? 1;
  const t = ctx.currentTime;
  switch (kind) {
    case 'shoot':
      noise(ctx, dest, t, 0.09, 0.35 * v, 'bandpass', 1400 * p, 0.8, 500 * p);
      tone(ctx, dest, t, 620 * p, 190 * p, 0.14, 0.28 * v, 'sine');
      tone(ctx, dest, t, 2400 * p, 1800 * p, 0.05, 0.08 * v, 'triangle');
      break;
    case 'bounce':
      tone(ctx, dest, t, 1500 * p, 1100 * p, 0.07, 0.22 * v, 'sine');
      noise(ctx, dest, t, 0.03, 0.12 * v, 'highpass', 3000);
      break;
    case 'bounceObstacle':
      tone(ctx, dest, t, 720 * p, 520 * p, 0.1, 0.26 * v, 'triangle');
      noise(ctx, dest, t, 0.05, 0.1 * v, 'lowpass', 1200);
      break;
    case 'attach':
      tone(ctx, dest, t, 990 * p, 940 * p, 0.16, 0.2 * v, 'sine');
      tone(ctx, dest, t + 0.012, 1480 * p, 1420 * p, 0.12, 0.12 * v, 'sine');
      noise(ctx, dest, t, 0.02, 0.1 * v, 'highpass', 4000);
      break;
    case 'crack':
      noise(ctx, dest, t, 0.16, 0.16 * v, 'bandpass', 2600 * p, 2);
      tone(ctx, dest, t, 300 * p, 260 * p, 0.16, 0.05 * v, 'sawtooth');
      break;
    case 'explode':
      noise(ctx, dest, t, 0.32, 0.5 * v, 'bandpass', 3200 * p, 0.7, 900);
      noise(ctx, dest, t, 0.18, 0.3 * v, 'lowpass', 400, 0.7, 120);
      tone(ctx, dest, t, 2100 * p, 1200 * p, 0.28, 0.16 * v, 'sine');
      tone(ctx, dest, t + 0.03, 3150 * p, 2400 * p, 0.22, 0.1 * v, 'triangle');
      break;
    case 'cascade': {
      const notes = [1, 1.25, 1.5, 2];
      notes.forEach((n, i) => tone(ctx, dest, t + i * 0.07, 1046 * n * p, 1046 * n * p, 0.32, 0.12 * v, 'sine'));
      break;
    }
    case 'reveal': {
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 2640 * p;
      lfo.frequency.value = 9;
      lfoGain.gain.value = 60;
      lfo.connect(lfoGain).connect(osc.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 * v, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(g).connect(dest);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 0.6);
      lfo.stop(t + 0.6);
      tone(ctx, dest, t + 0.05, 3960 * p, 3960 * p, 0.4, 0.04 * v, 'sine');
      break;
    }
    case 'drop':
      noise(ctx, dest, t, 0.28, 0.2 * v, 'lowpass', 900 * p, 0.8, 200);
      tone(ctx, dest, t, 420 * p, 160 * p, 0.3, 0.1 * v, 'sine');
      break;
    case 'land':
      tone(ctx, dest, t, 220 * p, 150 * p, 0.12, 0.22 * v, 'sine');
      noise(ctx, dest, t, 0.04, 0.08 * v, 'lowpass', 800);
      break;
    case 'colorChange':
      tone(ctx, dest, t, 1320 * p, 1320 * p, 0.07, 0.1 * v, 'sine');
      tone(ctx, dest, t + 0.06, 1760 * p, 1760 * p, 0.09, 0.08 * v, 'sine');
      break;
    case 'win': {
      const notes = [1, 1.25, 1.5, 2, 2.5, 3];
      notes.forEach((n, i) => {
        tone(ctx, dest, t + i * 0.11, 660 * n, 660 * n, 0.7, 0.14 * v, 'sine');
        tone(ctx, dest, t + i * 0.11, 1320 * n, 1320 * n, 0.5, 0.05 * v, 'triangle');
      });
      noise(ctx, dest, t + 0.6, 0.9, 0.06 * v, 'highpass', 5000);
      break;
    }
    case 'lost':
      tone(ctx, dest, t, 500 * p, 220 * p, 0.25, 0.12 * v, 'triangle');
      break;
    case 'ui':
      tone(ctx, dest, t, 1800 * p, 1500 * p, 0.05, 0.1 * v, 'sine');
      break;
    default:
      break;
  }
}
