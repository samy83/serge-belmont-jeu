# PROGRESS — état du prototype

Dernière mise à jour : 2026-09-14 (session 1, création du projet).

## Où en est le projet

**Prototype V1 jouable dans le navigateur** : `npm run dev`, puis Jouer.

Fait et vérifié :

- [x] Coeur déterministe (vol, contacts, règle des 3, chutes qui se posent ou
      quittent le niveau, réactions en chaîne, séquence de couleurs, trophées)
      — 88 tests Vitest verts (`npm test`).
- [x] Dix niveaux en données (`src/data/levels/`), engendrés par
      `tools/gen_levels.py`, validés par les tests (aucun groupe de 3 initial,
      tout tient, seuils cohérents).
- [x] Rendu PixiJS : billes de verre procédurales, voile de velours et
      révélation de la photo disque par disque, canon avec anneau de compte à
      rebours et bille suivante, ligne de visée animée avec bille fantôme,
      obstacles gris, effets (éclats, étincelles, ondes, flashs, secousse),
      chutes animées, victoire (photo entière).
- [x] Entrée tactile (viser / tirer / annuler / déplacer le canon), souris
      pour le bureau.
- [x] Interface DOM : titre, niveaux (déverrouillage, trophées, meilleur
      score), HUD (tirs, trophée encore atteignable), pause (reprendre,
      recommencer, niveaux, volumes), victoire (photo, trophée, stats, badges,
      niveau suivant, partage si disponible), collection (grille + plein
      écran), réglages (volumes, qualité, effacement).
- [x] Sauvegarde locale versionnée (progression, collection, réglages).
- [x] Audio Web Audio avec sons de synthèse (verre) et manifeste remplaçable ;
      volumes général / musique / effets.
- [x] Qualité adaptative (3 paliers, détection + surveillance de la cadence).
- [x] Hors ligne : service worker (production), aucun réseau requis.
- [x] Abstractions social / publicité / achats / synchronisation (nulles).
- [x] Build de production (`npm run build`, ≈ 200 Ko gzip).
- [x] Documentation : AGENTS.md, README, ARCHITECTURE, GAMEPLAY, DECISIONS.

Vérifié dans le navigateur intégré (viewport mobile 375×812 et 900×1700) :
titre → niveau 1 → visée avec ligne et fantôme → tir → pose blottie →
explosion d'un groupe de 3 → révélation de la photo → partie complète →
écran de victoire → progression sauvegardée → niveau 2 déverrouillé →
niveau 5 (obstacles gris, billes suspendues, chutes).

## Ce qui n'a PAS été vérifié

- Le ressenti réel sur un téléphone (cadence, toucher, sons) : le navigateur
  intégré bride requestAnimationFrame, les animations n'y ont été vues qu'en
  captures. **Premier geste de la prochaine session : jouer sur un vrai
  smartphone** (`npm run dev -- --host`, puis l'adresse réseau affichée).
- Les sons de synthèse (pas d'écoute possible ici) : ils ne lèvent aucune
  erreur, leur goût est à juger.
- L'équilibrage des seuils de trophées (or ≈ billes / 2,3) : un auto-joueur
  naïf finit le niveau 1 en 15 tirs ; un humain qui attend les couleurs et
  vise les paires devrait faire ~10-12.

## Limites connues / dette

- Photographies : images de substitution générées (`public/photos/`), à
  remplacer fichier par fichier (900 × 1280 ou toute image, cadrage « cover »).
- Sons : synthèse seulement ; pour des fichiers, les nommer dans
  `public/audio/manifest.json`. Pas de musique en V1.
- Police de titre : pile système (Georgia/serif) ; une fonte OFL embarquée
  (ex. Cormorant Garamond) rendrait le titre plus fidèle à la DA.
- Pas de tutoriel ni de premier niveau guidé.
- Pas de condition de défaite (voulu en V1, voir DECISIONS D10).
- `TrajectoryView` redessine un Graphics à chaque déplacement du doigt (fine
  sur mobile moyen ; à convertir en sprites si un profil montre un coût).
- Le service worker met en cache à la demande (pas de précache exhaustif) :
  la première visite doit charger chaque niveau/photo pour qu'il soit
  disponible hors ligne ensuite.
- Aucun test automatisé du rendu.

## Prochaines étapes (ordre conseillé)

1. **Play-test sur téléphone** et retouches de game feel : vitesse de la
   bille, durée des explosions, force de la secousse, taille de la révélation.
2. Vraies photographies + cadrage (`photo.focusX/focusY/scale`) par niveau ;
   crédit affiché.
3. Sons : remplacer les recettes de synthèse par des fichiers (manifeste) ;
   musique d'ambiance sur le bus `music`.
4. Fonte de titre embarquée (OFL) et ajustements d'interface sur petits écrans.
5. Tutoriel du niveau 1 (surbrillance de la paire à viser, texte court).
6. Équilibrage : rejouer les 10 niveaux, recaler `trophies` niveau par niveau.
7. Ensuite seulement : intégration Facebook (SDK) derrière `SocialProvider`,
   publicité récompensée derrière `AdsProvider` (désactivée par défaut),
   synchronisation derrière `SyncProvider`.
8. Extensions de contenu : 4e/5e couleur (`amber`, `amethyst` sont prêtes),
   nouveaux obstacles (`ObstacleType`), boosters (dans `GameSession`).

## Vérifier une partie complète (console du navigateur)

```js
// Sur un niveau en cours : tire automatiquement vers la meilleure paire jusqu'a la victoire.
const c = __sb.controller;
async function step() {
  const s = c.session; if (!s || s.state !== 'playing') return false;
  let best = null;
  for (let a = 12; a <= 168; a += 1) {
    const rad = a * Math.PI / 180, dir = { x: Math.cos(rad), y: -Math.sin(rad) };
    const f = s.predict(dir); if (f.outcome !== 'attached') continue;
    let score = -1;
    if (f.attachSurface === 'ball') { const t = s.board.get(f.attachTargetId); if (t && t.color === s.currentColor) score = s.board.colorGroup(t.id).length; }
    if (!best || score > best.score) best = { score, dir };
  }
  if (!best) return false; await c.fire(best.dir); return true;
}
while (await step()) {}
```

## Journal des sessions

- **2026-09-14** — Création : analyse de la spec, choix de la stack, coeur +
  tests, rendu, interface, plateforme, niveaux, documentation. Commits :
  fondation, rendu/interface/plateforme, polish et docs.
