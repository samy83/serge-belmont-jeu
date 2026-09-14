/**
 * Service audio : un contexte Web Audio deverrouille au premier geste, trois
 * volumes (general, musique, effets), et un manifeste qui associe chaque
 * evenement sonore a un fichier (s'il existe) ou a une recette de synthese.
 *
 * Remplacer un son = deposer le fichier dans public/audio/ et le nommer dans
 * public/audio/manifest.json. Le code ne change pas.
 */
import { playSynth, type SynthKind, type SynthOptions } from './synth';

export interface AudioManifestEntry {
  /** Fichier relatif a public/audio/ (ex. "sfx/shoot.ogg"). Absent = synthese. */
  file?: string;
  /** Recette de synthese employee quand il n'y a pas de fichier. */
  synth?: SynthKind;
  /** Volume propre a ce son (1 = plein). */
  volume?: number;
  /** "music" pour le bus musique, sinon effets. */
  bus?: 'sfx' | 'music';
  loop?: boolean;
}

export type AudioManifest = Record<string, AudioManifestEntry>;

/** Manifeste par defaut : tout en synthese. Le fichier public/audio/manifest.json le surcharge. */
export const DEFAULT_MANIFEST: AudioManifest = {
  shoot: { synth: 'shoot' },
  bounce: { synth: 'bounce' },
  bounceObstacle: { synth: 'bounceObstacle' },
  attach: { synth: 'attach' },
  crack: { synth: 'crack' },
  explode: { synth: 'explode' },
  cascade: { synth: 'cascade' },
  reveal: { synth: 'reveal' },
  drop: { synth: 'drop' },
  land: { synth: 'land' },
  colorChange: { synth: 'colorChange', volume: 0.7 },
  win: { synth: 'win' },
  lost: { synth: 'lost' },
  ui: { synth: 'ui' },
  music: { bus: 'music', loop: true, volume: 0.5 },
};

export interface AudioVolumes {
  master: number;
  music: number;
  sfx: number;
}

export class AudioService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private manifest: AudioManifest = { ...DEFAULT_MANIFEST };
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer | null>>();
  private musicSource: AudioBufferSourceNode | null = null;
  private volumes: AudioVolumes = { master: 0.9, music: 0.6, sfx: 1 };
  private muted = false;

  constructor(private readonly baseUrl: string) {}

  /** Charge le manifeste (optionnel : sans lui, tout est synthetise). */
  async loadManifest(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}audio/manifest.json`, { cache: 'no-cache' });
      if (!res.ok) return;
      const json = (await res.json()) as AudioManifest;
      this.manifest = { ...DEFAULT_MANIFEST, ...json };
    } catch {
      /* hors ligne ou absent : la synthese suffit */
    }
  }

  /** A appeler depuis un geste utilisateur (touch/click) : les mobiles l'exigent. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setVolumes(v: Partial<AudioVolumes>): void {
    this.volumes = { ...this.volumes, ...v };
    this.applyVolumes();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.master || !this.sfxBus || !this.musicBus) return;
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    this.sfxBus.gain.value = this.volumes.sfx;
    this.musicBus.gain.value = this.volumes.music;
  }

  /** Joue un son nomme (evenement de jeu). Silencieux tant que le contexte n'est pas deverrouille. */
  play(name: string, opts: SynthOptions = {}): void {
    if (!this.ctx || !this.sfxBus || !this.musicBus) return;
    const entry = this.manifest[name];
    if (!entry) return;
    const bus = entry.bus === 'music' ? this.musicBus : this.sfxBus;
    const volume = (opts.volume ?? 1) * (entry.volume ?? 1);
    if (entry.file) {
      const buf = this.buffers.get(entry.file);
      if (buf) {
        this.playBuffer(buf, bus, volume, opts.pitch ?? 1, entry.loop ?? false, entry.bus === 'music');
        return;
      }
      void this.loadBuffer(entry.file);
      // En attendant le fichier, la synthese assure la continuite.
    }
    if (entry.synth) playSynth(this.ctx, bus, entry.synth, { pitch: opts.pitch, volume });
  }

  private playBuffer(buf: AudioBuffer, bus: AudioNode, volume: number, pitch: number, loop: boolean, isMusic: boolean): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.playbackRate.value = pitch;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(bus);
    src.start();
    if (isMusic) {
      this.musicSource?.stop();
      this.musicSource = src;
    }
  }

  private loadBuffer(file: string): Promise<AudioBuffer | null> {
    const pending = this.loading.get(file);
    if (pending) return pending;
    const p = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}audio/${file}`);
        if (!res.ok || !this.ctx) return null;
        const data = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(data);
        this.buffers.set(file, buf);
        return buf;
      } catch {
        return null;
      }
    })();
    this.loading.set(file, p);
    return p;
  }

  /** Precharge les fichiers du manifeste (sans bloquer le jeu). */
  preload(): void {
    for (const entry of Object.values(this.manifest)) if (entry.file) void this.loadBuffer(entry.file);
  }

  stopMusic(): void {
    this.musicSource?.stop();
    this.musicSource = null;
  }
}
