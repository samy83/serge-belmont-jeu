# serge-belmont-jeu

Le contexte du projet pour tout agent de codage est dans `AGENTS.md` (objectif,
architecture, commandes, conventions, règles à ne pas casser, état). Le lire
en premier.

@AGENTS.md

Compléments propres à Claude Code :

- Les descriptions des appels d'outils s'écrivent en français (Samy les lit).
- Avant tout commit : `npm run check` (typecheck + tests + build).
- Le serveur de dev se lance avec `npm run dev` ; dans le navigateur intégré,
  `?maxframe=1000` accélère le temps de jeu quand requestAnimationFrame est bridé.
