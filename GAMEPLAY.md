# Gameplay — les règles telles qu'implémentées

Référence : `src/core`. Toute valeur citée est un défaut modifiable par niveau.

## 1. Le plateau

Repère logique 900 × 1600 (largeur × hauteur), origine en haut à gauche.
Le **cadre** (zone de jeu et de la photo) va de y = 0 à `floorY` (1280). Le
canon est en dessous (y = 1472), déplaçable entre `minX` et `maxX`. Les billes
ont un rayon de 42 (10 billes tiennent en largeur).

Les billes n'ont pas de grille : deux billes sont **en contact** si la
distance de leurs centres est ≤ 2r × (1 + 0,06) (tolérance `contactTolerance`
0,12 × r). Les niveaux sont écrits en disposition ASCII (empilement
hexagonal), mais rien dans le moteur ne suppose une grille.

## 2. Le tir

- Vitesse 2 400 unités/s, ligne droite (gravité 0 ; une gravité > 0 est
  supportée par la simulation), rebonds parfaits sur les bords gauche/droit et
  sur les obstacles, au plus 12 rebonds.
- Le plafond est une **ancre** : une bille qui l'atteint s'y colle. Les bords
  latéraux peuvent aussi être déclarés ancres par niveau.
- La bille s'arrête au **premier contact** avec une bille posée (distance
  exactement 2r), puis se **blottit** : si une seconde bille est presque
  touchée, elle se cale pour toucher exactement les deux.
- Une bille qui redescend sous la ligne de chute (après rebond sur un
  obstacle, par exemple) est **perdue** : le tir compte, rien ne se pose.
- Angle minimal 8° au-dessus de l'horizontale.
- La **ligne de visée** est calculée par la même simulation : elle montre tous
  les rebonds jusqu'au point de pose (`difficulty.predictionBounces` peut la
  tronquer) et une bille fantôme à l'endroit exact où la bille se posera.

## 3. La couleur du canon

Séquence cyclique connue (`colorSequence.sequence`, par défaut rubis → saphir
→ émeraude), une couleur toutes les `intervalMs` (3 000 à 5 000 ms selon le
niveau). L'anneau autour de la bille chargée se vide ; pendant les `warningMs`
dernières millisecondes la bille palpite et l'anneau blanchit (signal de
changement imminent). La couleur suivante est toujours affichée. Le compte à
rebours continue pendant le vol (option `pauseDuringFlight` pour le figer).

## 4. Règle des 3

Après la pose, le groupe connexe (par contacts) de même couleur contenant la
bille posée est calculé. **S'il compte 3 billes ou plus, il explose.** Deux
billes identiques collées restent collées.

## 5. Chutes et réactions en chaîne

Après une explosion, ce qui **ne tient plus** tombe. Une bille tient si elle
touche une ancre (plafond, obstacle gris, bord déclaré ancre, bille marquée
`anchored`) ou une bille qui tient.

Mode `settle: "land"` (défaut) : les grappes tombent toutes à la même vitesse,
tout droit ; une grappe qui rencontre un appui s'y **pose** (et devient un
appui pour les suivantes) ; une grappe qui atteint la ligne de chute **quitte
le niveau** (ses billes comptent comme détruites et révèlent la photo).

Après les chutes, tout groupe de 3+ formé par une grappe posée **explose à son
tour** (chaîne : `chain` 1, 2, …), et ainsi de suite jusqu'à stabilité. Mode
`settle: "drop"` : tout ce qui ne tient plus quitte le niveau sans se poser.

Tout est déterministe : le résultat complet est calculé avant la première
image d'animation.

## 6. Révélation

Chaque bille détruite (explosion ou chute hors du niveau) efface un disque du
voile de rayon `reveal.radiusFactor × r` (1,7 × r) à bord doux
(`softness` 0,55) autour de sa position : la zone révélée est plus grande que
la bille, les disques voisins se fondent en une forme organique. L'ouverture
est animée (onde), avec flash et son. Quand le plateau est vide, le voile
disparaît entièrement : photo complète, victoire.

La photo est cadrée « cover » dans le cadre (900 × 1280) avec un point de
focus (`focusX`, `focusY`) et un zoom (`scale`), ou « contain ».

## 7. Fin de niveau et trophées

Il n'y a pas de défaite en V1 : la partie continue tant qu'il reste des
billes. La performance est le **nombre de tirs** : `trophies.gold` /
`silver` / `bronze` sont des seuils inclusifs par niveau (ex. 10 / 14 / 19).
Le HUD affiche le palier encore atteignable et le nombre de tirs restants
avant de le perdre. Le trophée, le meilleur nombre de tirs et la photo sont
enregistrés ; le niveau suivant se déverrouille.

## 8. Format d'un niveau (`src/data/levels/level-XX.json`)

```json
{
  "id": "level-03",
  "index": 3,
  "name": "La pierre grise",
  "colors": ["ruby", "sapphire", "emerald"],
  "colorSequence": { "sequence": ["ruby", "sapphire", "emerald"], "intervalMs": 4500, "warningMs": 1100 },
  "layout": {
    "legend": { "R": "ruby", "S": "sapphire", "E": "emerald", "#": "block", ".": "" },
    "packing": "hex",
    "rows": [".SERSERSE.", ".ERSERSER.", "..SE##SE..", "..RSERSE.."]
  },
  "photo": { "src": "photos/level-03.jpg", "title": "La pierre grise", "focusY": 0.4 },
  "reveal": { "radiusFactor": 1.7, "softness": 0.55 },
  "trophies": { "metric": "shots", "gold": 12, "silver": 16, "bronze": 21 },
  "difficulty": { "predictionBounces": -1 }
}
```

Champs facultatifs (défauts dans `core/level/loader.ts`) : `board` (width,
height, ballRadius, floorY, walls, anchors, contactTolerance), `cannon` (x, y,
minX, maxX, movable, minAngleDeg), `physics` (speed, gravity, maxBounces,
settle, dt, maxFlightTime), `balls` et `obstacles` explicites (coordonnées
logiques, cumulables avec `layout`), `colorSequence.startIndex` et
`pauseDuringFlight`, `photo.fit/focusX/scale/credit`.

Dans une disposition hexagonale, une case `#` fait 2r de large et
`2 × rowStep − 2r` de haut (61,5 unités) pour que les billes des rangées
voisines soient exactement tangentes ; les cases contiguës d'une rangée
fusionnent en un seul obstacle.

Validation au chargement : dimensions, couleurs connues, séquence cohérente,
seuils croissants, aucune bille hors cadre ni chevauchante. Les tests
vérifient de plus qu'aucun niveau livré ne contient de groupe de 3 au départ
et que toutes ses billes tiennent.

## 9. Réglage (où changer quoi)

| Sensation                         | Où                                              |
| --------------------------------- | ----------------------------------------------- |
| Vitesse de la bille, rebonds      | `physics.speed`, `physics.maxBounces` (niveau)  |
| Rythme des couleurs               | `colorSequence.intervalMs/warningMs` (niveau)   |
| Taille de la révélation           | `reveal.radiusFactor`, `reveal.softness`        |
| Difficulté des trophées           | `trophies` (niveau) ; `tools/gen_levels.py` calcule or ≈ billes / 2,3 |
| Couleurs des billes               | `src/data/colors.ts`                            |
| Intensité des effets / cadence    | `src/render/quality.ts`                         |
| Durées d'animation                | `src/render/scene/levelView.ts` (constantes lisibles) |
| Sons                              | `public/audio/manifest.json`, `src/platform/audio/synth.ts` |
