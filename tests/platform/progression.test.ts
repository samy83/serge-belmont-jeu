import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '@platform/storage/storage';
import { ProgressionStore, emptySave, migrateSave } from '../../src/progression/progressionStore';

const result = { shots: 7, timeMs: 42000, matches: 4, maxChain: 1, ballsMatched: 12, ballsDropped: 2 };

describe('ProgressionStore', () => {
  it('part vierge, enregistre une victoire, et relit la meme chose depuis le stockage', () => {
    const storage = new MemoryStorage();
    const store = new ProgressionStore(storage);
    expect(store.level('level-01').completed).toBe(false);
    expect(store.isUnlocked(1, ['level-01', 'level-02'])).toBe(true);
    expect(store.isUnlocked(2, ['level-01', 'level-02'])).toBe(false);

    const news = store.recordWin('level-01', result, 'silver');
    expect(news).toEqual({ newBest: true, newTrophy: true, newPhoto: true });
    expect(store.isUnlocked(2, ['level-01', 'level-02'])).toBe(true);
    expect(store.hasPhoto('level-01')).toBe(true);

    const reloaded = new ProgressionStore(storage);
    expect(reloaded.level('level-01')).toEqual({ completed: true, bestShots: 7, bestTimeMs: 42000, trophy: 'silver', plays: 0 });
    expect(reloaded.snapshot.collection).toEqual(['level-01']);
    expect(reloaded.snapshot.stats.levelsCompleted).toBe(1);
  });

  it('garde le meilleur trophee et le meilleur nombre de tirs', () => {
    const store = new ProgressionStore(new MemoryStorage());
    store.recordWin('l', result, 'gold');
    const news = store.recordWin('l', { ...result, shots: 12 }, 'bronze');
    expect(news.newBest).toBe(false);
    expect(news.newTrophy).toBe(false);
    expect(news.newPhoto).toBe(false);
    expect(store.level('l').trophy).toBe('gold');
    expect(store.level('l').bestShots).toBe(7);
    expect(store.snapshot.stats.totalShots).toBe(19);
  });

  it('sauvegarde les reglages et survit a un effacement de progression', () => {
    const storage = new MemoryStorage();
    const store = new ProgressionStore(storage);
    store.updateSettings({ sfxVolume: 0.25, quality: 'low' });
    store.recordWin('l', result, 'gold');
    store.reset();
    expect(store.level('l').completed).toBe(false);
    expect(new ProgressionStore(storage).settings.sfxVolume).toBe(0.25);
  });
});

describe('migrateSave', () => {
  it('rend une sauvegarde valide a partir de rien ou de bruit', () => {
    expect(migrateSave(null)).toEqual(emptySave());
    expect(migrateSave('n importe quoi')).toEqual(emptySave());
    const s = migrateSave({ version: 1, levels: { a: { completed: 'oui', bestShots: '3', trophy: 'platine' } }, settings: { masterVolume: 9, quality: 'ultra' } });
    expect(s.levels.a).toEqual({ completed: true, bestShots: null, bestTimeMs: null, trophy: 'none', plays: 0 });
    expect(s.settings.masterVolume).toBe(1);
    expect(s.settings.quality).toBe('auto');
  });

  it('ignore un JSON corrompu dans le stockage', () => {
    const storage = new MemoryStorage();
    storage.set('serge-belmont.save', '{pas du json');
    const store = new ProgressionStore(storage);
    expect(store.snapshot.collection).toEqual([]);
  });
});
