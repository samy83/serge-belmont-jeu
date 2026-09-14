/**
 * Point d'entree : configuration, service worker (hors ligne, production
 * seulement), puis le chef d'orchestre.
 */
import '@ui/styles.css';
import { loadConfig } from '@config/gameConfig';
import { GameController } from './game/gameController';

const config = loadConfig();

if (config.serviceWorker && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${config.assetBaseUrl}sw.js`).catch((err) => console.warn('[sw] enregistrement refuse', err));
  });
}

const controller = new GameController(config);
// Poignee de debogage (console du navigateur) : window.__sb.controller
(window as unknown as { __sb?: unknown }).__sb = { controller, config };
controller.start().catch((err) => {
  console.error(err);
  const ui = document.getElementById('ui');
  if (ui) {
    ui.innerHTML = `<div class="screen"><h1 class="title">Serge Belmont</h1><p class="hint">Le jeu n’a pas pu démarrer : ${String(err)}</p></div>`;
  }
});
