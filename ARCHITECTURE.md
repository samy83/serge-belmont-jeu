# Architecture

## 1. Vue d'ensemble

Trois couches, séparées par des frontières nettes, plus une couche plateforme
générique destinée à être partagée par les futurs jeux Serge Belmont.

```
┌──────────────────────────── ui/ (DOM, CSS) ────────────────────────────┐
│ écrans : titre, niveaux, HUD, pause, victoire, collection, réglages     │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ actions nommées / données à afficher
┌────────────────────────────────▼───────────────────────────────────────┐
│ game/gameController.ts — le chef d'orchestre (seul à connaître tout)   │
└───┬───────────────────┬───────────────────┬───────────────────┬────────┘
    │                   │                   │                   │
┌───▼──────────┐  ┌─────▼──────────┐  ┌─────▼─────────┐  ┌──────▼────────────┐
│ core/        │  │ render/ (Pixi) │  │ input/        │  │ platform/         │
│ logique pure │  │ rejoue les     │  │ doigt ->      │  │ storage, audio,   │
│ déterministe │  │ résultats      │  │ intentions    │  │ social, ads, sync │
└──────────────┘  └────────────────┘  └───────────────┘  │ progression/      │
                                                         └───────────────────┘
```

Règle de dépendance : `core` ne dépend de rien (ni DOM, ni Pixi). `render`
dépend de `core` (types, résultats) et de Pixi. `ui` ne dépend de rien du jeu
(elle reçoit des données simples). `gameController` dépend de tout.

## 2. Le coeur (`src/core`)

### Modèle (`model/types.ts`)

Un niveau (`LevelDef`) décrit tout dans un repère logique (par défaut
900 × 1600, y vers le bas) : plateau (`BoardDef` : dimensions, rayon des
billes, ligne de chute `floorY`, bords qui rebondissent, ancres qui
soutiennent), canon, physique, couleurs et séquence, billes et obstacles,
photo, révélation, trophées, difficulté. `LevelSource` est la forme écrite dans
les JSON (tout optionnel sauf `id` et `photo`), `loadLevel()` complète et valide.

Le plateau est **sans grille** : les billes ont des positions libres, et la
structure vient des **contacts** (distance ≤ 2r + tolérance). La disposition
ASCII des niveaux (`layout`) n'est qu'un format d'auteur converti en positions
au chargement (empilement hexagonal par défaut).

### Vol (`physics/flight.ts`)

`simulateFlight(world, x, y, dirX, dirY, params)` : pas de temps fixe
(1/120 s), contacts calculés analytiquement dans chaque pas (balayage
point/cercle et cercle/rectangle arrondi) donc aucun tunnel, rebonds exacts
(réflexion, vitesse conservée), arrêt au premier contact avec une bille ou une
ancre, gravité optionnelle (0 par défaut : arcade). Renvoie les positions
échantillonnées, les événements datés (rebond, pose, perte) et l'issue.
**C'est la seule implémentation** : la ligne de visée l'appelle aussi.

### Plateau (`board/board.ts`)

`Board` : ajout/retrait/déplacement de billes, voisins, groupe de couleur,
groupes ≥ 3, **soutien** (`supported()` : parcours depuis les ancres — plafond,
bords, obstacles, billes `anchored` — par les contacts), composantes connexes,
**blottissement** (`nestle` : une bille posée contre une voisine se cale pour
toucher exactement une deuxième voisine proche).

### Résolution (`board/resolve.ts`)

`resolveBoard(board, physics, landedBallId)` mute le plateau jusqu'à l'état
stable et renvoie les étapes ordonnées :

```
match(groupe ≥ 3) -> settle() -> nouveaux groupes ≥ 3 ? -> match... (chaîne)
```

`settle()` : toutes les grappes qui ne tiennent plus tombent ensemble ; celle
qui rencontre en premier un appui (bille qui tient, obstacle si ancre) s'y pose
et devient un appui pour les suivantes ; une grappe qui atteint `floorY` quitte
le niveau. Mode `drop` : tout ce qui ne tient plus quitte le niveau.

### Session (`game/session.ts`)

`GameSession` tient le plateau, le canon, la séquence de couleurs, les
compteurs. `fire(dir)` → `ShotResult` (vol, position de contact puis blottie,
contacts, étapes de résolution, victoire). `predict(dir)` → le même vol sans
tirer. `update(dtMs, busy)` fait avancer la séquence de couleurs.

## 3. Le rendu (`src/render`)

- `GameApp` : application Pixi, canvas plein écran, plateau logique mis à
  l'échelle et centré sous un espace réservé au HUD (56 px). `toLogical()`
  convertit un point écran.
- `LevelView` : la scène d'un niveau. `playShot(shot, token)` rejoue le
  résultat : recul du canon, vol (positions interpolées, effets aux rebonds),
  pose avec blottissement et secousse des voisines, puis chaque étape :
  `playMatch` (tremblement/contraction, flash, ondes, éclats, retrait des
  billes, révélation animée, secousse d'écran) et `playFall` (chute accélérée,
  pose avec rebond ou sortie fondue avec révélation). Un `CancelToken`
  interrompt proprement quand on quitte le niveau.
- `PhotoReveal` : la photo (cadrée « cover » avec point de focus) sous le
  **voile** : une `RenderTexture` où le velours est peint une fois, puis
  effacée disque par disque (sprite-pinceau en mode `erase`, sous un conteneur
  racine). Aucun filtre, aucun masque de sprite : une seule sprite à dessiner.
- Textures procédurales (`textures/`) : Canvas 2D au lancement, cache par
  couleur/taille. La bille de verre (`ballCanvas.ts`) suit une recette
  documentée (corps, bande sombre, caustique, lueur, fresnel, reflets).
- `Effects` : particules en réserve (aucune allocation en jeu), plafond par
  palier ; étincelles, éclats, ondes, flashs, poussières, secousse.
- `Tweens` : interpolations pilotées par la boucle du jeu (pas de timers), en
  promesses : les séquences s'écrivent en `async/await`.
- `quality.ts` : trois paliers (`low/medium/high`), détection au lancement,
  `FpsMonitor` abaisse d'un palier si la cadence reste basse.

## 4. Entrée (`src/input/pointerInput.ts`)

Pointer Events, un seul pointeur. Sous le cadre : déplacement du canon. Dans
le cadre : visée continue (direction canon → doigt, contrainte à l'angle
minimal) puis tir au relâchement ; redescendre sous le cadre annule.

## 5. Interface (`src/ui`)

DOM + CSS (pas de framework) : une classe `Ui` monte un écran à la fois
(`innerHTML` + délégation `data-action`) et rappelle des actions nommées
(`UiActions`). Le HUD est un bandeau fixe en haut. Aucun `backdrop-filter`
(coûteux sur vieux mobiles).

## 6. Plateforme (`src/platform`, `src/progression`)

- `KeyValueStorage` : localStorage si utilisable, sinon mémoire.
- `ProgressionStore` : sauvegarde versionnée (`version: 1`) avec migration
  tolérante ; niveaux (terminé, meilleur nombre de tirs, trophée), collection,
  réglages, statistiques. Déverrouillage linéaire (niveau n si n-1 terminé).
- `AudioService` : contexte Web Audio déverrouillé au premier geste, bus
  général/musique/effets, manifeste (`public/audio/manifest.json`) →
  fichier ou recette de synthèse (`synth.ts`).
- `services.ts` : interfaces `SocialProvider`, `AdsProvider`,
  `PurchaseProvider`, `SyncProvider` + implémentations nulles/Web Share. Les
  dépendances de plateforme (SDK Facebook, régie publicitaire, boutique) y
  sont documentées ; rien n'est supposé disponible.

## 7. Hors ligne / en ligne

Tout le gameplay est local : niveaux dans le bundle, photos et audio dans
`public/`, progression dans localStorage. Un service worker minimal
(`public/sw.js`, production seulement) met en cache ce qui a été chargé et le
sert d'abord depuis le cache. La couche en ligne (synchronisation, classement,
partage, publicité) passe uniquement par `PlatformServices` : une coupure
réseau ne peut pas atteindre une partie en cours.

## 8. Performance mobile

- Repère logique fixe, canvas à résolution bornée par palier (1 / 1,5 / 2).
- Une texture par couleur de bille (192 px), sprites simples, pas de filtre.
- Révélation : une RenderTexture à demi-résolution, écriture seulement lors
  des explosions.
- Particules bornées (70 / 180 / 320), pas d'allocation pendant le jeu.
- Lueurs sous les billes, respiration et poussières désactivables (palier bas).
- Détection d'appareil + surveillance de la cadence → descente de palier.
- Build cible ES2018 (Chrome 75+, Safari 13+), bundle ≈ 200 Ko gzip
  (dont ≈ 170 Ko PixiJS).

## 9. Tests

Vitest, environnement Node (le coeur n'a pas besoin de DOM) :
`tests/core/*` (vol, plateau, résolution, règles, session, chargement),
`tests/data/levels.test.ts` (les 10 niveaux : valides, aucun groupe de 3 au
départ, tout tient), `tests/platform/progression.test.ts` (sauvegarde,
migration). Le rendu n'est pas testé automatiquement : vérification visuelle
dans le navigateur (`npm run dev`).

## 10. Extensibilité prévue

- Couleurs : ajouter à `data/colors.ts` et citer dans `colors` d'un niveau.
- Obstacles : `ObstacleType` (V1 : `block`) ; un type destructible ou mobile
  ajoutera un champ au modèle, une règle dans `resolve.ts`/`flight.ts` et une
  texture.
- Boosters / pouvoirs : à brancher dans `GameSession` (avant `fire`) et à
  déclarer dans les données de niveau ; le rendu suit les étapes renvoyées.
- Critères de trophées : `TrophyDef.metric` et `LevelResult`.
- Futurs jeux : réutiliser `platform/`, `progression/`, `ui/styles.css`,
  `render/tween.ts`, `render/quality.ts`, `render/fx/effects.ts`.
