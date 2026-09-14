/**
 * Modele de donnees du coeur du jeu.
 *
 * Tout ici est de la donnee pure (serialisable en JSON) : aucune dependance au
 * rendu, au DOM ou a PixiJS. Les niveaux sont ecrits dans ce format (voir
 * src/data/levels/*.json) puis normalises par `loadLevel()`.
 *
 * Unites : le plateau est decrit dans un repere logique (par defaut 900 x 1600,
 * origine en haut a gauche, y vers le bas). Le rendu adapte ce repere a l'ecran.
 */

/** Identifiant d'une couleur de boule ("ruby", "sapphire", ...). Voir src/data/colors.ts. */
export type ColorId = string;

export interface Vec2 {
  x: number;
  y: number;
}

/** Une boule posee sur le plateau. */
export interface Ball {
  id: number;
  x: number;
  y: number;
  color: ColorId;
  /** Boule qui tient toute seule (ancree au decor), meme sans contact avec une ancre. */
  anchored?: boolean;
}

/** Definition d'une boule dans un fichier de niveau (l'id est attribue au chargement). */
export interface BallDef {
  x: number;
  y: number;
  color: ColorId;
  anchored?: boolean;
}

/** Types d'obstacles. V1 : uniquement "block" (case grise). Les autres viendront sans toucher au moteur. */
export type ObstacleType = 'block';

/** Un obstacle rectangulaire, immobile, indestructible, aligne sur les axes. */
export interface Obstacle {
  id: number;
  type: ObstacleType;
  /** Coin haut-gauche. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ObstacleDef {
  type?: ObstacleType;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Disposition en texte (ASCII) : chaque ligne est une rangee, chaque caractere
 * une cellule de largeur `cell`. La legende associe un caractere a une couleur
 * de boule, a un obstacle ("block") ou a du vide ("").
 *
 * Exemple :
 *   rows: ["RSERSE", " RSERS "]  (les rangees impaires sont decalees d'une demi-cellule en "hex")
 */
export interface LayoutDef {
  rows: string[];
  legend: Record<string, ColorId | 'block' | ''>;
  /** Largeur d'une cellule en unites logiques (defaut : 2 x rayon). */
  cell?: number;
  /** Centre de la premiere rangee (defaut : rayon, c'est-a-dire collee au plafond). */
  originY?: number;
  /** Centre de la premiere cellule d'une rangee paire (defaut : centre automatiquement). */
  originX?: number;
  /** "hex" : rangees serrees et decalees (defaut) ; "square" : grille carree. */
  packing?: 'hex' | 'square';
}

export interface BoardDef {
  width: number;
  height: number;
  ballRadius: number;
  /** Ligne de chute : une boule dont le centre passe sous cette ligne quitte le niveau. */
  floorY: number;
  /** Bords sur lesquels la boule tiree rebondit. */
  walls: { left: boolean; right: boolean; top: boolean };
  /**
   * Ce qui soutient les boules : une boule "tient" si elle touche une ancre ou
   * une boule qui tient. Les autres tombent apres une explosion.
   */
  anchors: { top: boolean; left: boolean; right: boolean; obstacles: boolean };
  /** Tolerance de contact entre boules, en fraction du rayon (defaut 0.12). */
  contactTolerance: number;
}

export interface CannonDef {
  x: number;
  y: number;
  minX: number;
  maxX: number;
  movable: boolean;
  /** Angle minimal du tir par rapport a l'horizontale, en degres (defaut 8). */
  minAngleDeg: number;
}

export interface PhysicsDef {
  /** Vitesse de la boule tiree, en unites par seconde. */
  speed: number;
  /** Gravite pendant le vol (0 = ligne droite, le defaut "arcade"). */
  gravity: number;
  /** Nombre maximal de rebonds avant que la boule soit perdue. */
  maxBounces: number;
  /**
   * Devenir des groupes qui ne tiennent plus :
   *  - "land" : ils tombent et se posent sur ce qui tient (peuvent former de nouveaux groupes) ;
   *  - "drop" : ils quittent le niveau directement.
   */
  settle: 'land' | 'drop';
  /** Pas de temps fixe de la simulation en secondes (defaut 1/120). */
  dt: number;
  /** Duree maximale d'un vol en secondes (garde-fou). */
  maxFlightTime: number;
}

export interface ColorSequenceDef {
  /** Ordre des couleurs dans le canon, cyclique. */
  sequence: ColorId[];
  /** Duree pendant laquelle une couleur reste dans le canon (ms). */
  intervalMs: number;
  /** Duree du signal "changement imminent" avant la bascule (ms). */
  warningMs: number;
  /** Index de depart dans la sequence (defaut 0). */
  startIndex: number;
  /** Si vrai, le compte a rebours se fige pendant le vol et les reactions. */
  pauseDuringFlight: boolean;
}

export interface PhotoDef {
  /** Chemin relatif a public/ (ex. "photos/level-01.jpg"). */
  src: string;
  title?: string;
  credit?: string;
  /** "cover" remplit le cadre (defaut), "contain" montre toute l'image. */
  fit: 'cover' | 'contain';
  /** Point de l'image garde au centre du cadre en "cover" (0..1). */
  focusX: number;
  focusY: number;
  /** Zoom supplementaire (1 = aucun). */
  scale: number;
}

export interface RevealDef {
  /** Rayon de la zone revelee par boule detruite, en multiples du rayon d'une boule. */
  radiusFactor: number;
  /** Douceur du bord (0 = net, 1 = tres flou). */
  softness: number;
  /** Forme de la zone revelee. V1 : "circle". */
  shape: 'circle';
}

export type TrophyTier = 'gold' | 'silver' | 'bronze' | 'none';

export interface TrophyDef {
  /** Critere evalue (V1 : nombre de tirs ; les autres criteres viendront ici). */
  metric: 'shots';
  /** Seuils inclusifs : shots <= gold -> or, <= silver -> argent, <= bronze -> bronze. */
  gold: number;
  silver: number;
  bronze: number;
}

export interface DifficultyDef {
  /** Nombre de rebonds montres par la ligne de visee (-1 = tous jusqu'au contact). */
  predictionBounces: number;
}

/** Un niveau normalise, pret pour le moteur. */
export interface LevelDef {
  id: string;
  index: number;
  name: string;
  board: BoardDef;
  cannon: CannonDef;
  physics: PhysicsDef;
  colors: ColorId[];
  colorSequence: ColorSequenceDef;
  balls: BallDef[];
  obstacles: ObstacleDef[];
  photo: PhotoDef;
  reveal: RevealDef;
  trophies: TrophyDef;
  difficulty: DifficultyDef;
}

/**
 * Un niveau tel qu'ecrit dans un fichier JSON : tout est optionnel sauf l'id et
 * la photo, `loadLevel()` complete avec les defauts et convertit `layout`.
 */
export type LevelSource = {
  id: string;
  index?: number;
  name?: string;
  board?: Partial<Omit<BoardDef, 'walls' | 'anchors'>> & {
    walls?: Partial<BoardDef['walls']>;
    anchors?: Partial<BoardDef['anchors']>;
  };
  cannon?: Partial<CannonDef>;
  physics?: Partial<PhysicsDef>;
  colors?: ColorId[];
  colorSequence?: Partial<ColorSequenceDef>;
  balls?: BallDef[];
  obstacles?: ObstacleDef[];
  layout?: LayoutDef;
  photo: Partial<PhotoDef> & { src: string };
  reveal?: Partial<RevealDef>;
  trophies?: Partial<TrophyDef>;
  difficulty?: Partial<DifficultyDef>;
};
