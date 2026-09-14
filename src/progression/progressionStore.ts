/**
 * Progression du joueur : niveaux termines, meilleurs scores, trophees,
 * collection de photographies, reglages. Sauvegardee localement a chaque
 * changement ; versionnee pour pouvoir migrer les anciennes sauvegardes.
 *
 * Generique : rien ici n'est propre au puzzle (un futur jeu Serge Belmont
 * peut reutiliser ce magasin avec sa propre cle).
 */
import type { TrophyTier } from '@core/model/types';
import { bestTrophy } from '@core/rules/trophies';
import type { LevelResult } from '@core/rules/trophies';
import type { KeyValueStorage } from '@platform/storage/storage';

export interface LevelProgress {
  completed: boolean;
  bestShots: number | null;
  bestTimeMs: number | null;
  trophy: TrophyTier;
  plays: number;
}

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  quality: 'auto' | 'low' | 'medium' | 'high';
}

export interface SaveData {
  version: 1;
  levels: Record<string, LevelProgress>;
  /** Identifiants de niveaux dont la photo est debloquee, dans l'ordre d'obtention. */
  collection: string[];
  settings: Settings;
  stats: { totalShots: number; totalMatches: number; totalPlayMs: number; levelsCompleted: number };
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = { masterVolume: 0.9, musicVolume: 0.6, sfxVolume: 1, quality: 'auto' };

export function emptySave(): SaveData {
  return {
    version: 1,
    levels: {},
    collection: [],
    settings: { ...DEFAULT_SETTINGS },
    stats: { totalShots: 0, totalMatches: 0, totalPlayMs: 0, levelsCompleted: 0 },
    updatedAt: 0,
  };
}

/** Rend une sauvegarde valide quelle que soit la version lue (ou du bruit). */
export function migrateSave(raw: unknown): SaveData {
  const base = emptySave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData> & { version?: number };
  // Version 1 : format courant. Les versions futures ajouteront leurs conversions ici.
  if (r.levels && typeof r.levels === 'object') {
    for (const [id, p] of Object.entries(r.levels)) {
      if (!p || typeof p !== 'object') continue;
      base.levels[id] = {
        completed: Boolean(p.completed),
        bestShots: typeof p.bestShots === 'number' ? p.bestShots : null,
        bestTimeMs: typeof p.bestTimeMs === 'number' ? p.bestTimeMs : null,
        trophy: isTier(p.trophy) ? p.trophy : 'none',
        plays: typeof p.plays === 'number' ? p.plays : 0,
      };
    }
  }
  if (Array.isArray(r.collection)) base.collection = r.collection.filter((x): x is string => typeof x === 'string');
  if (r.settings && typeof r.settings === 'object') {
    base.settings = {
      masterVolume: clampVolume(r.settings.masterVolume, DEFAULT_SETTINGS.masterVolume),
      musicVolume: clampVolume(r.settings.musicVolume, DEFAULT_SETTINGS.musicVolume),
      sfxVolume: clampVolume(r.settings.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      quality: ['auto', 'low', 'medium', 'high'].includes(String(r.settings.quality)) ? (r.settings.quality as Settings['quality']) : 'auto',
    };
  }
  if (r.stats && typeof r.stats === 'object') {
    base.stats = {
      totalShots: num(r.stats.totalShots),
      totalMatches: num(r.stats.totalMatches),
      totalPlayMs: num(r.stats.totalPlayMs),
      levelsCompleted: num(r.stats.levelsCompleted),
    };
  }
  base.updatedAt = num(r.updatedAt);
  return base;
}

function isTier(v: unknown): v is TrophyTier {
  return v === 'gold' || v === 'silver' || v === 'bronze' || v === 'none';
}

function clampVolume(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export class ProgressionStore {
  private data: SaveData;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key = 'serge-belmont.save',
  ) {
    this.data = this.load();
  }

  private load(): SaveData {
    const raw = this.storage.get(this.key);
    if (!raw) return emptySave();
    try {
      return migrateSave(JSON.parse(raw));
    } catch {
      return emptySave();
    }
  }

  save(): boolean {
    this.data.updatedAt = Date.now();
    return this.storage.set(this.key, JSON.stringify(this.data));
  }

  get snapshot(): Readonly<SaveData> {
    return this.data;
  }

  level(id: string): LevelProgress {
    return (
      this.data.levels[id] ?? {
        completed: false,
        bestShots: null,
        bestTimeMs: null,
        trophy: 'none',
        plays: 0,
      }
    );
  }

  /** Le niveau d'index n (1 = premier) est jouable si le precedent est termine. */
  isUnlocked(levelIndex: number, orderedIds: string[]): boolean {
    if (levelIndex <= 1) return true;
    const prev = orderedIds[levelIndex - 2];
    return prev !== undefined && this.level(prev).completed;
  }

  recordPlay(id: string): void {
    const p = this.level(id);
    p.plays++;
    this.data.levels[id] = p;
    this.save();
  }

  /** Enregistre une victoire ; renvoie ce qui est nouveau (pour l'ecran de fin). */
  recordWin(id: string, result: LevelResult, trophy: TrophyTier): { newBest: boolean; newTrophy: boolean; newPhoto: boolean } {
    const p = this.level(id);
    const newBest = p.bestShots === null || result.shots < p.bestShots;
    const best = bestTrophy(p.trophy, trophy);
    const newTrophy = best !== p.trophy;
    if (!p.completed) this.data.stats.levelsCompleted++;
    p.completed = true;
    if (newBest) p.bestShots = result.shots;
    if (p.bestTimeMs === null || result.timeMs < p.bestTimeMs) p.bestTimeMs = result.timeMs;
    p.trophy = best;
    this.data.levels[id] = p;
    const newPhoto = !this.data.collection.includes(id);
    if (newPhoto) this.data.collection.push(id);
    this.data.stats.totalShots += result.shots;
    this.data.stats.totalMatches += result.matches;
    this.data.stats.totalPlayMs += result.timeMs;
    this.save();
    return { newBest, newTrophy, newPhoto };
  }

  get settings(): Settings {
    return this.data.settings;
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
  }

  hasPhoto(id: string): boolean {
    return this.data.collection.includes(id);
  }

  /** Efface toute la progression (reglages conserves). */
  reset(): void {
    const settings = this.data.settings;
    this.data = emptySave();
    this.data.settings = settings;
    this.save();
  }
}
