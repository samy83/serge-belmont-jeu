# Décisions techniques

Chaque décision : le contexte, les options comparées, le choix, ce qu'il
coûte. Une décision se renverse en ajoutant une entrée, pas en effaçant.

## D1 — Stack : TypeScript + PixiJS 8 + Vite 7 + Vitest 4 (2026-09-14)

Options comparées pour un jeu mobile web performant sur smartphones anciens,
repris ensuite par un agent de codage :

| Option | Pour | Contre |
| --- | --- | --- |
| **PixiJS 8 + Vite (retenu)** | Rendu WebGL 1/2 batché, très rapide sur vieux GPU ; bibliothèque de rendu seulement, donc le coeur du jeu reste du TypeScript pur et testable ; API claire et documentée, familière aux agents ; bundle ≈ 170 Ko gzip | Pas de framework de jeu : scènes, tweens, entrée à écrire (fait, en petit) |
| Phaser 3/4 | Tout inclus (scènes, tweens, physique, audio) | Plus lourd (≈ 1 Mo), physique intégrée non déterministe et inutile ici, tendance à mélanger logique et rendu, Phaser 4 en transition |
| Canvas 2D pur | Zéro dépendance, portabilité maximale | Fill-rate limité sur vieux mobiles pour lueurs/particules, scène et batching à réécrire |
| Three.js | Puissant | 3D : inutile pour un jeu 2D, courbe et poids supérieurs |
| Godot / Unity (export web) | Éditeurs complets | Binaires wasm lourds, chargement lent sur mobile, difficile à reprendre par un agent de codage, solution propriétaire (Unity) — exclu par la spec |

Reprise par Codex : projet TypeScript standard, scripts npm, tests Vitest,
`AGENTS.md` à la racine (Codex lit ce fichier), aucune génération de code ni
outil propriétaire.

## D2 — Physique arcade maison, déterministe (pas de Matter.js/Box2D)

La spec exige une trajectoire prédictive stable et une physique arcade
contrôlée. Un moteur physique généraliste est non déterministe d'une machine à
l'autre, coûteux, et ne sait pas « s'arrêter au contact ». La simulation
maison (`core/physics/flight.ts`) fait un balayage exact par pas fixe : ligne
droite (gravité optionnelle), rebonds parfaits, arrêt au premier contact.
**La ligne de visée et le vol sont la même fonction.** Coût : quelques
centaines de lignes, entièrement testées.

## D3 — Plateau sans grille : la structure vient des contacts

La spec dit « pas un match-3 classique avec une grille » et « les boules se
comportent comme des objets physiques attachés ». Les billes ont donc des
positions libres ; groupes et soutien se calculent sur un graphe de contacts
(distance ≤ 2r + tolérance). Le blottissement (`nestle`) régularise la
structure sans imposer de grille. Les niveaux sont néanmoins écrits en
ASCII hexagonal, un simple format d'auteur. Coût : O(n²) sur ~60 billes,
négligeable ; une grille spatiale pourra venir si des niveaux dépassent
quelques centaines de billes.

## D4 — Chutes « qui se posent » plutôt que « qui disparaissent »

La spec demande une réorganisation avec nouvelles connexions et nouvelles
explosions automatiques. Les grappes qui ne tiennent plus tombent donc tout
droit et se posent sur ce qui tient (réactions en chaîne), et ne quittent le
niveau que si elles atteignent la ligne de chute. Le mode `drop` (tout
disparaît) reste disponible par niveau. Le calcul est déterministe et exact
(distance de contact analytique, grappes traitées dans l'ordre des rencontres).

## D5 — Le coeur résout tout avant l'animation

`GameSession.fire()` renvoie le résultat complet (vol, pose, étapes) ; le
rendu ne fait que rejouer. Conséquences : tests sans rendu, déterminisme,
possibilité future de rediffusion, de solveur, de vérification de niveaux.
Coût : le rendu doit rester fidèle aux étapes (durées, ordre) — c'est le rôle
unique de `LevelView`.

## D6 — Révélation par RenderTexture + mode `erase`, sans masque ni filtre

Trois techniques envisagées : masque de sprite (filtre à chaque image),
shader dédié, ou voile peint dans une RenderTexture et effacé par un pinceau
en mode de fusion `erase`. La troisième ne coûte rien pendant le jeu (une
sprite de plus), seulement une écriture par disque révélé, et marche sur
WebGL 1. Piège rencontré : Pixi ignore le mode de fusion d'un objet rendu comme
racine — le pinceau est rendu sous un conteneur parent.

## D7 — Textures procédurales (Canvas 2D) plutôt que des images

Billes, lueurs, éclats, anneaux, voile et cases sont dessinés au lancement.
Avantages : aucun fichier image à charger, cohérence de lumière, couleurs
ajoutables en une ligne (`data/colors.ts`), taille adaptable. Coût : quelques
dizaines de ms au premier niveau. Les photographies restent des fichiers.

## D8 — Interface en DOM/CSS, jeu en canvas

Les écrans (titre, niveaux, victoire, collection, réglages) sont en DOM :
typographie, accessibilité, mise en page et animations CSS sont bien plus
rapides à rendre premium qu'en Pixi, et un agent de codage les modifie sans
connaître Pixi. Ce qui est lié au plateau (canon, ligne de visée, effets)
reste en canvas. Le HUD réserve 56 px en haut ; le plateau est cadré dessous.
Pas de `backdrop-filter` (trop coûteux sur vieux mobiles).

## D9 — Audio : Web Audio, manifeste, synthèse de secours

Pas de fichiers audio en V1 : des recettes de synthèse (`synth.ts`) donnent
une matière sonore de verre. Le manifeste (`public/audio/manifest.json`)
associe chaque événement à un fichier dès qu'il existe, sans changer le code ;
la synthèse assure la continuité pendant le chargement. Trois volumes
(général, musique, effets) sauvegardés.

## D10 — Pas de défaite en V1

La spec ne définit aucune condition de perte et juge la performance au nombre
de tirs. Le prototype n'a donc pas de « game over » ; le trophée descend avec
les tirs. Une limite de tirs ou une ligne de mort pourra être ajoutée par
niveau (`difficulty`), sans toucher au moteur.

## D11 — Niveaux engendrés par un script d'auteur, mais livrés en données

`tools/gen_levels.py` décrit chaque niveau par un masque (forme) et tire les
couleurs sous contrainte (aucun groupe de 3 initial, tout tient). Le JSON
produit est la seule source pour le moteur : on peut le retoucher à la main.
Seuils de trophées : or ≈ billes / 2,3 (un tir qui rejoint une paire retire
deux billes existantes) — à recaler après des tests joueurs.

## D12 — Hors ligne par service worker minimal, sans plugin

Un service worker de 40 lignes (cache d'abord, réseau pour compléter),
enregistré seulement en production, plutôt que `vite-plugin-pwa` (workbox) :
moins de dépendances, comportement lisible. À revoir si le déploiement exige
un précache exhaustif.

## D13 — Monétisation et social : interfaces seulement

`SocialProvider`, `AdsProvider`, `PurchaseProvider`, `SyncProvider` sont
déclarés avec des implémentations nulles (et Web Share pour le partage). Aucun
SDK Facebook n'est supposé disponible ; les dépendances sont documentées dans
`platform/services.ts`. Tout se désactive par construction en développement.

## D14 — Versions épinglées « stables connues »

TypeScript ~5.9 (et non 7.x natif), Vite ^7 (et non 8), Vitest ^4 : versions
largement documentées, que les agents de codage connaissent. `.npmrc` force
`legacy-peer-deps` pour contourner un plantage d'npm 10.9 sur la résolution
des peer-dependencies de Vitest 4.
