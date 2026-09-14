import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// Un seul fichier de configuration pour Vite (dev/build) et Vitest (tests).
// Les alias doivent rester identiques a ceux de tsconfig.json ("paths").
const alias = {
  '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
  '@render': fileURLToPath(new URL('./src/render', import.meta.url)),
  '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
  '@platform': fileURLToPath(new URL('./src/platform', import.meta.url)),
  '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
  '@config': fileURLToPath(new URL('./src/config', import.meta.url)),
};

export default defineConfig({
  // Chemins relatifs : le build se sert depuis n'importe quel sous-dossier
  // (hebergement statique, Facebook Instant Games, Capacitor...).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: { alias },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    // Smartphones anciens : on transpile la syntaxe vers ~2019 (pas de polyfills).
    target: ['es2018', 'chrome75', 'safari13', 'firefox70'],
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/platform/**', 'src/progression/**'],
    },
  },
});
