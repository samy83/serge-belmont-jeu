/**
 * Sauvegarde locale : une interface cle/valeur minuscule, avec localStorage
 * quand il existe (mode prive, quotas et navigateurs capricieux compris) et
 * une memoire de secours sinon. Le jeu ne parle jamais a localStorage
 * directement : il pourra etre remplace (IndexedDB, plateforme native).
 */

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

export class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): boolean {
    this.map.set(key, value);
    return true;
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

export class LocalStorageAdapter implements KeyValueStorage {
  constructor(private readonly ls: Storage) {}
  get(key: string): string | null {
    try {
      return this.ls.getItem(key);
    } catch {
      return null;
    }
  }
  set(key: string, value: string): boolean {
    try {
      this.ls.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
  remove(key: string): void {
    try {
      this.ls.removeItem(key);
    } catch {
      /* rien a faire */
    }
  }
}

/** localStorage s'il est utilisable, sinon la memoire (la partie reste jouable). */
export function createStorage(): KeyValueStorage {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return new MemoryStorage();
    const probe = '__sb_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return new LocalStorageAdapter(ls);
  } catch {
    return new MemoryStorage();
  }
}
