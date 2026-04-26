/**
 * Tests d'intégration de BBM.API contre une mock Firestore en mémoire.
 * Couvre les écritures et lectures du watch party + chat + reactions
 * + skip markers + ratings.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { resetBBM, setupStubs, loadFile } from './load-bbm.js';
import { createMockDB } from './firestore-mock.js';

beforeEach(() => {
  resetBBM();
  setupStubs();
  // Surcharge le FieldValue.delete pour qu'il retourne notre sentinel
  globalThis.firebase.firestore.FieldValue.delete = () => '__delete__';
  loadFile('js/api.js');
  globalThis.BBM.db = createMockDB();
});

describe('BBM.API.createWatchParty + getter', () => {
  test('crée un doc avec hostUid et participants', async () => {
    const code = await BBM.API.createWatchParty({
      tmdbID: 42, title: 'Inception',
      videoURL: 'https://x.mp4', type: 'movie'
    });
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    const snap = await BBM.db.collection('watchParties').doc(code).get();
    expect(snap.exists).toBe(true);
    const data = snap.data();
    expect(data.code).toBe(code);
    expect(data.hostUid).toBe('test-uid');
    expect(data.title).toBe('Inception');
    expect(data.started).toBe(false);
    expect(data.participants['test-uid']).toBeTruthy();
  });
});

describe('BBM.API.startWatchParty', () => {
  test('flip started=true et currentTime=0', async () => {
    const code = await BBM.API.createWatchParty({ tmdbID: 1, title: 'X', videoURL: 'a' });
    await BBM.API.startWatchParty(code);
    const data = (await BBM.db.collection('watchParties').doc(code).get()).data();
    expect(data.started).toBe(true);
    expect(data.currentTime).toBe(0);
    expect(data.isPlaying).toBe(true);
  });
});

describe('BBM.API.joinWatchParty', () => {
  test('ajoute le user dans participants + post le message système', async () => {
    const code = await BBM.API.createWatchParty({ tmdbID: 1, title: 'X', videoURL: 'a' });
    // Change l'identité pour simuler un autre user
    BBM.Auth.currentUser = { uid: 'guest-1', displayName: 'Bob', email: 'b@x.com' };
    const data = await BBM.API.joinWatchParty(code);
    expect(data).toBeTruthy();
    const snap = await BBM.db.collection('watchParties').doc(code).get();
    expect(snap.data().participants['guest-1']).toBeTruthy();
    // Vérifie qu'un message système a été posté
    const msgsSnap = await BBM.db.collection('watchParties').doc(code)
      .collection('messages').get();
    expect(msgsSnap.size).toBeGreaterThan(0);
    const joinMsg = msgsSnap.docs.find(d => d.data().system && /rejoint/.test(d.data().text));
    expect(joinMsg).toBeTruthy();
  });

  test('throw si code introuvable', async () => {
    await expect(BBM.API.joinWatchParty('XXXXXX')).rejects.toThrow('introuvable');
  });
});

describe('BBM.API.leaveWatchParty', () => {
  test('retire le user des participants + post message système', async () => {
    const code = await BBM.API.createWatchParty({ tmdbID: 1, title: 'X', videoURL: 'a' });
    BBM.Auth.currentUser = { uid: 'guest-1', displayName: 'Bob', email: 'b@x.com' };
    await BBM.API.joinWatchParty(code);
    await BBM.API.leaveWatchParty(code, 'guest-1');
    const data = (await BBM.db.collection('watchParties').doc(code).get()).data();
    expect(data.participants['guest-1']).toBeUndefined();
    const msgsSnap = await BBM.db.collection('watchParties').doc(code)
      .collection('messages').get();
    const leaveMsg = msgsSnap.docs.find(d => d.data().system && /quitté/.test(d.data().text));
    expect(leaveMsg).toBeTruthy();
  });
});

describe('BBM.API chat + reactions', () => {
  let code;
  beforeEach(async () => {
    code = await BBM.API.createWatchParty({ tmdbID: 1, title: 'X', videoURL: 'a' });
  });

  test('sendChatMessage écrit dans messages', async () => {
    await BBM.API.sendChatMessage(code, 'Hello !');
    const snap = await BBM.db.collection('watchParties').doc(code)
      .collection('messages').get();
    const myMsg = snap.docs.find(d => d.data().text === 'Hello !');
    expect(myMsg).toBeTruthy();
    expect(myMsg.data().senderUid).toBe('test-uid');
  });

  test('sendChatMessage tronque à 500 chars', async () => {
    const long = 'a'.repeat(1000);
    await BBM.API.sendChatMessage(code, long);
    const snap = await BBM.db.collection('watchParties').doc(code)
      .collection('messages').get();
    const myMsg = snap.docs.find(d => d.data().text && d.data().text.length === 500);
    expect(myMsg).toBeTruthy();
  });

  test('sendChatMessage rate-limit 500ms', async () => {
    BBM.API._rateLimit.lastChatAt = Date.now(); // bloque
    await BBM.API.sendChatMessage(code, 'spam');
    const snap = await BBM.db.collection('watchParties').doc(code)
      .collection('messages').get();
    const spamMsg = snap.docs.find(d => d.data().text === 'spam');
    expect(spamMsg).toBeUndefined();
  });

  test('sendReaction écrit dans reactions', async () => {
    await BBM.API.sendReaction(code, '🔥');
    const snap = await BBM.db.collection('watchParties').doc(code)
      .collection('reactions').get();
    const myR = snap.docs.find(d => d.data().emoji === '🔥');
    expect(myR).toBeTruthy();
  });

  test('sendReaction rate-limit 250ms', async () => {
    BBM.API._rateLimit.lastReactionAt = Date.now();
    await BBM.API.sendReaction(code, '❤️');
    const snap = await BBM.db.collection('watchParties').doc(code)
      .collection('reactions').get();
    const myR = snap.docs.find(d => d.data().emoji === '❤️');
    expect(myR).toBeUndefined();
  });
});

describe('BBM.API skip markers', () => {
  test('setSkipMarkers + getSkipMarkers round-trip pour film', async () => {
    await BBM.API.setSkipMarkers('42', 'movie', null, null, {
      introStart: 0, introEnd: 60, outroStart: 7000, outroEnd: 7100
    });
    const data = await BBM.API.getSkipMarkers('42', 'movie', null, null);
    expect(data.introStart).toBe(0);
    expect(data.introEnd).toBe(60);
    expect(data.outroStart).toBe(7000);
    expect(data.outroEnd).toBe(7100);
    expect(data.tmdbID).toBe(42);
  });

  test('setSkipMarkers avec arrondi 1 décimale', async () => {
    await BBM.API.setSkipMarkers('42', 'movie', null, null, {
      introStart: 12.345
    });
    const data = await BBM.API.getSkipMarkers('42', 'movie', null, null);
    expect(data.introStart).toBe(12.3);
  });

  test('setSkipMarkers série utilise une clé composite', async () => {
    await BBM.API.setSkipMarkers('99', 'series', 1, 2, { introStart: 30 });
    const data = await BBM.API.getSkipMarkers('99', 'series', 1, 2);
    expect(data.introStart).toBe(30);
    expect(data.season).toBe(1);
    expect(data.episode).toBe(2);
  });

  test('setSkipMarkers refuse sans tmdbID', async () => {
    await expect(BBM.API.setSkipMarkers(null, 'movie', null, null, {}))
      .rejects.toThrow('tmdbID manquant');
  });

  test('setSkipMarkers refuse sans user connecté', async () => {
    BBM.Auth.currentUser = null;
    await expect(BBM.API.setSkipMarkers('42', 'movie', null, null, {}))
      .rejects.toThrow('Connexion requise');
  });
});

describe('BBM.API ratings (movie + episode)', () => {
  test('setRating écrit dans le doc user', async () => {
    // Crée d'abord le doc user
    await BBM.db.collection('users').doc('test-uid').set({ ratings: {} });
    await BBM.API.setRating('42', 4);
    const data = (await BBM.db.collection('users').doc('test-uid').get()).data();
    expect(data.ratings['42']).toBe(4);
  });

  test('setEpisodeRating utilise la clé composite', async () => {
    await BBM.db.collection('users').doc('test-uid').set({ ratings: {} });
    await BBM.API.setEpisodeRating('99', 1, 5, 5);
    const data = (await BBM.db.collection('users').doc('test-uid').get()).data();
    expect(data.ratings['99_s1_e5']).toBe(5);
  });

  test('setRating sans user → no-op', async () => {
    BBM.Auth.currentUser = null;
    await expect(BBM.API.setRating('42', 4)).resolves.toBeUndefined();
  });
});

describe('BBM.API listAllWatchParties (admin)', () => {
  test('retourne toutes les sessions', async () => {
    await BBM.API.createWatchParty({ tmdbID: 1, title: 'A', videoURL: 'a' });
    await BBM.API.createWatchParty({ tmdbID: 2, title: 'B', videoURL: 'b' });
    const all = await BBM.API.listAllWatchParties();
    expect(all.length).toBe(2);
    expect(all[0].title).toMatch(/^[AB]$/);
  });
});

describe('BBM.API auto-cleanup', () => {
  test('cleanupOwnStaleWatchParties supprime les vieilles parties', async () => {
    const code = await BBM.API.createWatchParty({ tmdbID: 1, title: 'X', videoURL: 'a' });
    // Force un updatedAt vieux de 7h (dépasse les 6h par défaut)
    const ref = BBM.db.collection('watchParties').doc(code);
    await ref.update({ updatedAt: { toMillis: () => Date.now() - 7 * 3600 * 1000 } });
    const removed = await BBM.API.cleanupOwnStaleWatchParties({ staleHours: 6 });
    expect(removed).toBe(1);
    expect((await ref.get()).exists).toBe(false);
  });

  test('cleanupOwnStaleWatchParties préserve les parties récentes', async () => {
    await BBM.API.createWatchParty({ tmdbID: 1, title: 'X', videoURL: 'a' });
    const removed = await BBM.API.cleanupOwnStaleWatchParties({ staleHours: 6 });
    expect(removed).toBe(0);
  });

  test('purgeStaleWatchParties admin', async () => {
    const code = await BBM.API.createWatchParty({ tmdbID: 1, title: 'X', videoURL: 'a' });
    const ref = BBM.db.collection('watchParties').doc(code);
    await ref.update({ updatedAt: { toMillis: () => Date.now() - 24 * 3600 * 1000 } });
    const removed = await BBM.API.purgeStaleWatchParties({ staleHours: 6 });
    expect(removed).toBe(1);
  });
});
