/**
 * Helper pour charger les modules BBM dans un test, avec un minimum
 * de stubs Firebase / BBM.Auth pour que les fichiers s'évaluent sans
 * crash. On teste les fonctions PURES (pas les opérations Firestore),
 * donc les stubs ne renvoient que ce qu'il faut pour ne pas exploser.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/** Charge js/config.js + js/api.js dans `globalThis` avec des stubs.
 *  Retourne la référence à BBM. */
export function loadBBM() {
  // Reset
  delete globalThis.BBM;
  delete globalThis.firebase;

  // Minimal Firebase stub — assez pour ne pas crasher l'évaluation.
  // Aucune opération réseau n'est appelée par les fonctions pures.
  globalThis.firebase = {
    firestore: {
      FieldValue: { delete: () => '__delete__', serverTimestamp: () => '__serverTs__' },
      Timestamp: { now: () => ({ toMillis: () => Date.now() }) }
    }
  };

  // BBM namespace + minimum requis par api.js
  globalThis.BBM = {
    Config: {
      tmdb: { baseURL: 'https://api.themoviedb.org/3', apiKey: 'TEST', language: 'fr', imageBase: 'https://image.tmdb.org/t/p' },
      cacheTTL: 24 * 3600 * 1000,
      posterSize: 'w342',
      backdropSize: 'w1280'
    },
    Auth: { currentUser: { uid: 'test-uid', displayName: 'Tester', email: 'test@x.com' } },
    db: null
  };

  // Charge api.js — son code suppose que BBM existe déjà
  const apiSource = readFileSync(resolve(ROOT, 'js/api.js'), 'utf8');
  // Évalue dans le scope global
  // eslint-disable-next-line no-new-func
  new Function(apiSource).call(globalThis);

  return globalThis.BBM;
}
