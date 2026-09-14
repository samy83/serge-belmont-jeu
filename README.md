# Serge Belmont — jeu mobile de billes de cristal (prototype V1)

Un puzzle/tir physique en 2D verticale, pensé pour le smartphone (portrait,
tactile, hors ligne) et une audience Facebook. Un canon tire des billes de
verre dont la couleur défile selon une séquence connue ; trois billes de même
couleur connectées explosent et révèlent, morceau par morceau, une
photographie de Serge Belmont cachée derrière le niveau. Quand la dernière
bille tombe, la photo rejoint la collection et un trophée récompense le petit
nombre de tirs.

> Prototype : 10 niveaux, photographies et sons de substitution. La direction
> artistique (verre, cristal, lumière, souvenir) est en place pour être jugée.

## Jouer en ligne

Chaque push sur `main` publie le jeu sur GitHub Pages
(`.github/workflows/pages.yml`) : **https://samy83.github.io/serge-belmont-jeu/**
— à ouvrir sur un téléphone, en portrait. La progression est sauvegardée sur
l'appareil.

## Démarrer

Prérequis : Node.js ≥ 20 (testé avec 22), npm ≥ 10. Python 3 + Pillow
seulement pour les outils d'auteur (niveaux, photos de substitution).

```bash
npm install
npm run dev        # http://localhost:5173 — ajouter --host pour tester sur un téléphone du réseau
npm test           # tests unitaires
npm run check      # typecheck + tests + build de production (dist/)
```

Le build (`dist/`) est un site statique à chemins relatifs : il se dépose tel
quel sur n'importe quel hébergement (ou dans une coquille Capacitor / Instant
Games plus tard).

## Jouer

- **Viser** : poser le doigt dans le cadre et le déplacer ; une ligne de
  points montre la trajectoire prévue, rebonds compris, et une bille fantôme
  l'endroit où la bille se posera.
- **Tirer** : relâcher. Redescendre le doigt sous le cadre annule.
- **Déplacer le canon** : glisser le doigt sous le cadre.
- **Attendre** : l'anneau autour de la bille chargée indique quand la couleur
  va changer ; la bille « suivante » est affichée. Un clignotement annonce la
  bascule. Le nombre de tirs décide du trophée, pas le temps.

## Documentation

| Fichier            | Contenu                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `AGENTS.md`        | Contexte pour un agent de codage (Codex, Claude…) : tout pour reprendre |
| `ARCHITECTURE.md`  | Couches, flux d'un tir, interfaces principales, rendu, performance, hors ligne |
| `GAMEPLAY.md`      | Les règles telles qu'implémentées, le format des niveaux, le réglage |
| `DECISIONS.md`     | Choix techniques et leurs alternatives (stack, physique, révélation…) |
| `PROGRESS.md`      | État du prototype, ce qui manque, prochaines étapes                  |

## Structure

```
src/core       logique pure du jeu (testée, déterministe, sans rendu)
src/render     rendu PixiJS : billes, révélation, effets, canon
src/ui         écrans et HUD en DOM/CSS
src/platform   services génériques (sauvegarde, audio, social, publicité, sync)
src/data       palette et niveaux (JSON)
tests          Vitest
tools          scripts d'auteur (Python)
public         photos, audio, service worker, manifeste PWA
```

## Licence et contenu

Les photographies de `public/photos/` sont des images de substitution générées
par script. Les vraies photographies de Serge Belmont les remplaceront fichier
par fichier, sans modification de code.
