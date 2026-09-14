/**
 * Catalogue des niveaux de la V1. Les fichiers JSON sont de la donnee pure ;
 * pour ajouter un niveau : creer level-11.json et l'ajouter ici (ou regenerer
 * avec tools/gen_levels.py). Le moteur n'a pas a changer.
 */
import type { LevelSource } from '@core/model/types';
import level01 from './level-01.json';
import level02 from './level-02.json';
import level03 from './level-03.json';
import level04 from './level-04.json';
import level05 from './level-05.json';
import level06 from './level-06.json';
import level07 from './level-07.json';
import level08 from './level-08.json';
import level09 from './level-09.json';
import level10 from './level-10.json';

export const LEVEL_SOURCES: LevelSource[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
] as LevelSource[];

export function findLevelSource(id: string): LevelSource | undefined {
  return LEVEL_SOURCES.find((l) => l.id === id);
}
