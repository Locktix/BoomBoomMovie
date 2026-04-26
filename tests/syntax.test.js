/**
 * Tests "syntax-only" — vérifie que chaque fichier JS du dossier /js/
 * peut être parsé sans erreur. Trivial à écrire, ça aurait évité plusieurs
 * régressions récentes (Uncaught SyntaxError, function brackets, etc.).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JS_DIR = resolve(__dirname, '..', 'js');

const files = readdirSync(JS_DIR).filter(f => f.endsWith('.js'));

describe('Syntax check — js/*.js', () => {
  for (const file of files) {
    test(`${file} parse sans erreur`, () => {
      const src = readFileSync(resolve(JS_DIR, file), 'utf8');
      // Le constructeur Function fait un parse complet sans exécuter
      expect(() => new Function(src)).not.toThrow();
    });
  }
});
