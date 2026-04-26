/**
 * Tests des helpers BBM.Auth — translation des erreurs Firebase, initiales, etc.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { resetBBM, setupStubs, loadFile } from './load-bbm.js';

beforeEach(() => {
  resetBBM();
  setupStubs();
  // Stub le firebase auth pour que auth.js ne crash pas au load
  globalThis.firebase.auth = () => ({
    onAuthStateChanged: () => {},
    signInWithEmailAndPassword: () => Promise.resolve(),
    createUserWithEmailAndPassword: () => Promise.resolve(),
    sendPasswordResetEmail: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
    currentUser: null
  });
  loadFile('js/auth.js');
});

describe('BBM.Auth.translateError', () => {
  const cases = [
    ['auth/email-already-in-use', /déjà utilisée/],
    ['auth/invalid-email', /invalide/],
    ['auth/weak-password', /6 caractères/],
    ['auth/user-not-found', /Aucun compte/],
    ['auth/wrong-password', /Mot de passe incorrect/],
    ['auth/too-many-requests', /Trop de tentatives/],
    ['auth/network-request-failed', /réseau/],
    ['auth/invalid-credential', /Email ou mot de passe/]
  ];
  test.each(cases)('%s → message FR contient %s', (code, regex) => {
    expect(BBM.Auth.translateError(code)).toMatch(regex);
  });
  test('code inconnu retourne un message par défaut', () => {
    const msg = BBM.Auth.translateError('auth/unknown-error');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});

describe('BBM.Auth.getInitials', () => {
  test('? si pas connecté', () => {
    BBM.Auth.currentUser = null;
    expect(BBM.Auth.getInitials()).toBe('?');
  });
  test('première lettre du displayName', () => {
    BBM.Auth.currentUser = { displayName: 'Alex', email: 'alex@x.com' };
    expect(BBM.Auth.getInitials()).toBe('A');
  });
  test('fallback sur email si pas de displayName', () => {
    BBM.Auth.currentUser = { displayName: null, email: 'sam@x.com' };
    expect(BBM.Auth.getInitials()).toBe('S');
  });
  test('? si rien', () => {
    BBM.Auth.currentUser = { displayName: null, email: null };
    expect(BBM.Auth.getInitials()).toBe('?');
  });
  test('majuscule forcée', () => {
    BBM.Auth.currentUser = { displayName: 'alice', email: '' };
    expect(BBM.Auth.getInitials()).toBe('A');
  });
});

describe('BBM.Auth.getDisplayName', () => {
  test('retourne displayName en priorité', () => {
    BBM.Auth.currentUser = { displayName: 'Alex', email: 'alex@x.com' };
    expect(BBM.Auth.getDisplayName()).toBe('Alex');
  });
  test('fallback sur partie locale de l\'email', () => {
    BBM.Auth.currentUser = { displayName: null, email: 'sam@x.com' };
    expect(BBM.Auth.getDisplayName()).toBe('sam');
  });
  test('"Utilisateur" si pas connecté', () => {
    BBM.Auth.currentUser = null;
    expect(BBM.Auth.getDisplayName()).toBe('Utilisateur');
  });
});
