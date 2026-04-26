/**
 * Helper pour charger les modules BBM dans un test, avec un minimum
 * de stubs Firebase / BBM.Auth pour que les fichiers s'évaluent sans
 * crash. On teste les fonctions PURES (pas les opérations Firestore),
 * donc les stubs ne renvoient que ce qu'il faut pour ne pas exploser.
 *
 * Utilise vm.runInThisContext avec un filename pour que la coverage v8
 * track bien les fichiers source (un new Function(src) ne serait pas
 * comptabilisé).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..');

/** Charge un fichier js/<name> dans le contexte courant. */
export function loadFile(relPath) {
  const fullPath = resolve(ROOT, relPath);
  const src = readFileSync(fullPath, 'utf8');
  vm.runInThisContext(src, { filename: fullPath });
}

/** Stubs Firebase + Settings + Auth requis par les fichiers BBM */
export function setupStubs() {
  globalThis.firebase = {
    firestore: {
      FieldValue: { delete: () => '__delete__', serverTimestamp: () => '__serverTs__' },
      Timestamp: { now: () => ({ toMillis: () => Date.now() }) }
    }
  };
  globalThis.BBM = globalThis.BBM || {};
  globalThis.BBM.Config = {
    tmdb: { baseURL: 'https://api.themoviedb.org/3', apiKey: 'TEST', language: 'fr', imageBase: 'https://image.tmdb.org/t/p' },
    cacheTTL: 24 * 3600 * 1000,
    posterSize: 'w342',
    backdropSize: 'w1280',
    profileSize: 'w185',
    workerAPI: 'https://example.test/worker',
    streamsAPI: null
  };
  globalThis.BBM.Auth = { currentUser: { uid: 'test-uid', displayName: 'Tester', email: 'test@x.com' } };
  globalThis.BBM.db = null;
}

export function resetBBM() {
  delete globalThis.BBM;
  delete globalThis.firebase;
}

/** Charge api.js dans globalThis avec stubs. Retourne BBM. */
export function loadBBM() {
  resetBBM();
  setupStubs();
  loadFile('js/api.js');
  return globalThis.BBM;
}

/** Charge tous les fichiers principaux + retourne BBM. */
export function loadAll() {
  resetBBM();
  setupStubs();
  // Settings doit être chargé en premier (utilisé par d'autres modules)
  loadFile('js/settings.js');
  loadFile('js/api.js');
  loadFile('js/auth.js');
  loadFile('js/mini-player.js');
  loadFile('js/update-modal.js');
  return globalThis.BBM;
}
