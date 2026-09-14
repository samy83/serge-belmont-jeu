# AGENTS.md — contexte pour les agents de codage (Codex, Claude, autres)

Ce fichier est LE point d'entrée. Il doit permettre de reprendre le projet sans
la conversation qui l'a créé. Les détails vivent dans `ARCHITECTURE.md`,
`GAMEPLAY.md`, `DECISIONS.md` et `PROGRESS.md` ; ce fichier dit où regarder.

## 1. Objectif du projet

**Serge Belmont** est un jeu mobile casual premium (web, portrait, tactile),
destiné d'abord à une audience Facebook. Puzzle/tir physique en 2D verticale :
un canon en bas tire des billes de cristal dont la couleur change à intervalles
réguliers ; les groupes de 3+ de même couleur explosent, ce qui révèle
progressivement une photographie de Serge Belmont cachée derrière le niveau.
Quand il ne reste plus aucune bille, la photo entière est révélée et rejoint la
collection ; un trophée (or/argent/bronze) récompense le petit nombre de tirs.

Direction artistique : premium, magique, nostalgique — verre, cristal,
lumière, photographie, souvenir. Priorités (dans l'ordre) : gameplay amusant,
sensation de tir, qualité visuelle, fluidité mobile, architecture propre.

État : **prototype V1 jouable** (10 niveaux, photos de substitution, sons de
synthèse). Voir `PROGRESS.md` pour l'état précis et les prochaines étapes.

## 2. Stack et commandes

TypeScript 5.9 · PixiJS 8 (rendu WebGL) · Vite 7 (dev/build) · Vitest 4 (tests)
· interface en DOM/CSS · aucune autre dépendance d'exécution.

```bash
npm install          # (.npmrc force legacy-peer-deps : bug npm 10 avec vitest 4)
npm run dev          # serveur de dev, http://localhost:5173 (--host : testable sur un téléphone du même réseau)
npm test             # tests unitaires (vitest run)
npm run typecheck    # tsc --noEmit
npm run build        # build de production dans dist/ (statique, chemins relatifs)
npm run preview      # sert dist/
npm run check        # typecheck + test + build : à lancer avant tout commit
python tools/gen_levels.py            # (re)génère src/data/levels/*.json depuis les masques
python tools/make_placeholder_photos.py  # (re)génère public/photos/*.jpg de substitution
```

Outils de débogage dans le navigateur : `window.__sb.controller` (le chef
d'orchestre), `?fps` (compteur de cadence, palier, particules), `?maxframe=1000`
(pas de temps non plafonné, pour les navigateurs qui brident
requestAnimationFrame), `?nosw` (pas de service worker).

## 3. Architecture en une page

```
src/
  core/        LOGIQUE PURE (aucune dépendance DOM/Pixi) — testée par tests/core
    model/types.ts        modèle de données (niveau, boule, obstacle, ...)
    level/loader.ts       défauts + disposition ASCII -> boules/obstacles + validation
    physics/flight.ts     simulation du vol (pas fixe, contacts exacts, rebonds) — sert AUSSI à la ligne de visée
    board/board.ts        plateau : boules à positions libres, contacts, groupes, soutien, blottissement
    board/resolve.ts      règle des 3, chutes (se posent ou quittent le niveau), réactions en chaîne
    rules/colorSequencer.ts  couleur du canon (séquence cyclique, avertissement)
    rules/trophies.ts     trophées selon le nombre de tirs (seuils par niveau)
    game/session.ts       une partie : tir -> résultat (vol + étapes de résolution)
  render/      PIXIJS — rejoue les résultats du coeur en animations, ne décide rien
    app.ts                application Pixi, cadrage du plateau logique (900x1600) dans l'écran
    textures/             textures procédurales (Canvas 2D) : billes de verre, lueurs, éclats, voile
    scene/levelView.ts    la scène d'un niveau (orchestration des animations d'un tir)
    scene/photoReveal.ts  photo + voile effacé disque par disque (RenderTexture, mode erase)
    scene/cannonView.ts, ballView.ts, trajectoryView.ts
    fx/effects.ts         particules en réserve bornée, ondes, flashs, secousse
    quality.ts            paliers de qualité + surveillance de la cadence
    tween.ts              mini-moteur d'interpolation piloté par la boucle
  input/pointerInput.ts   doigt -> intentions (viser, tirer, déplacer le canon)
  ui/                     écrans DOM (titre, niveaux, HUD, pause, victoire, collection, réglages) + styles.css
  platform/               GÉNÉRIQUE, réutilisable par les futurs jeux
    storage/              clé/valeur (localStorage ou mémoire)
    audio/                Web Audio : bus de volumes, manifeste, synthèse de secours
    services.ts           interfaces social / publicité / achats / synchronisation + implémentations nulles
  progression/progressionStore.ts  sauvegarde versionnée (niveaux, trophées, collection, réglages)
  game/gameController.ts  LE chef d'orchestre : relie coeur, rendu, entrée, UI, audio, progression
  data/colors.ts          palette des billes (3 couleurs + 2 prêtes)
  data/levels/*.json      LES NIVEAUX (données pures) + index.ts
  config/gameConfig.ts    configuration (variables VITE_*, .env.example)
  main.ts                 point d'entrée
public/photos/            photographies (une par niveau, chemin dans le JSON du niveau)
public/audio/manifest.json  association événement sonore -> fichier (sinon synthèse)
public/sw.js              service worker hors ligne (production seulement)
tests/                    Vitest : coeur, niveaux livrés, progression
tools/                    scripts d'auteur Python (niveaux, photos de substitution)
```

Flux d'un tir : `PointerInput` → `GameController.fire(dir)` →
`GameSession.fire()` (le coeur calcule TOUT synchroniquement : vol, pose,
explosions, chutes, chaîne — résultat déterministe) → `LevelView.playShot()`
rejoue le résultat en animations (await/async sur `Tweens`) → HUD/progression.

## 4. Conventions

- Langue : code (identifiants) en anglais, commentaires et documentation en
  français. Les commentaires expliquent le POURQUOI.
- TypeScript strict, pas de `any`. Alias d'import `@core/*`, `@render/*`,
  `@ui/*`, `@platform/*`, `@data/*`, `@config/*` (déclarés dans `tsconfig.json`
  ET `vite.config.ts` — garder les deux synchronisés).
- Fins de ligne LF (`.gitattributes`). Pas de secret dans Git (`.env` ignoré).
- Tout choix subjectif (durées, couleurs, seuils) vit dans une donnée (JSON de
  niveau, `data/colors.ts`, `render/quality.ts`), jamais en dur dans une
  fonction de logique.
- Les niveaux sont de la donnée : ajouter un niveau = un JSON + une ligne dans
  `src/data/levels/index.ts` (ou un masque dans `tools/gen_levels.py`).
- Les sons et les photos sont remplaçables sans toucher au code (manifeste,
  chemins dans les niveaux).
- Commits : un par étape cohérente, message en français décrivant l'étape.

## 5. Règles importantes — ce qu'il ne faut pas casser

1. **`src/core` reste pur** : aucune importation de `pixi.js`, du DOM ou de
   `Math.random()` dans le coeur. C'est ce qui rend le gameplay testable et
   déterministe.
2. **La ligne de visée et le vol réel appellent la même fonction**
   (`simulateFlight`). Ne jamais créer une seconde implémentation « approchée ».
3. **La règle des 3** : deux billes identiques collées ne font PAS un groupe ;
   il faut 3 billes connectées ou plus. Testé dans `tests/core/resolve.test.ts`.
4. **Le coeur résout tout avant l'animation** : `GameSession.fire()` renvoie le
   résultat complet ; `LevelView` ne fait que le rejouer. Toute nouvelle
   mécanique (bonus, obstacle destructible...) se code d'abord dans le coeur
   avec ses tests, puis dans le rendu.
5. **Pas de filtre ni de masque Pixi pendant le jeu** (vieux mobiles) : la
   révélation utilise une RenderTexture et le mode de fusion `erase`. Les
   particules sont bornées par le palier de qualité (`render/quality.ts`).
6. **Le mode de fusion d'un objet rendu comme racine est ignoré par Pixi** :
   toujours rendre un conteneur parent (voir `photoReveal.ts`).
7. **Le HUD réserve 56 px en haut** (`HUD_HEIGHT_PX`) : le plateau logique est
   cadré en dessous. Ne pas dessiner d'interface DOM par-dessus la première
   rangée de billes.
8. `npm run check` doit passer avant tout commit.

## 6. Comment tester

- `npm test` : 88 tests sur les règles critiques (contacts, règle des 3,
  chutes, chaînes, vol/rebonds, séquence de couleurs, trophées, chargement des
  niveaux, tous les niveaux livrés valides, sauvegarde/migration).
- Vérification visuelle : `npm run dev`, ouvrir sur un téléphone (ou le mode
  appareil des outils de développement, portrait 375x812). Dans la console,
  `window.__sb.controller.startLevel('level-05')` saute à un niveau.
- Un « auto-joueur » de test tient en quelques lignes dans la console (voir
  `PROGRESS.md`, section « Vérifier une partie complète »).

## 7. État actuel et prochaines étapes

Voir `PROGRESS.md` (tenu à jour à chaque session). Résumé : boucle de jeu
complète et jouable, 10 niveaux, révélation de photo, trophées, collection,
sauvegarde locale, sons de synthèse, hors ligne. Manquent : vraies
photographies et sons, tutoriel, intégration Facebook/publicité (interfaces
prêtes), équilibrage des niveaux par des tests joueurs.
