/**
 * Tests étendus de BBM.API — couverture des fonctions d'image, de timestamp,
 * de cache, de validation et de transformations diverses.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { loadBBM } from './load-bbm.js';

let BBM;
beforeEach(() => { BBM = loadBBM(); });

describe('Image URL builders', () => {
  test('getBackdropURL', () => {
    expect(BBM.API.getBackdropURL('/bg.jpg', 'w780'))
      .toBe('https://image.tmdb.org/t/p/w780/bg.jpg');
    expect(BBM.API.getBackdropURL(null)).toBeNull();
  });
  test('getStillURL utilise w300', () => {
    expect(BBM.API.getStillURL('/still.jpg'))
      .toBe('https://image.tmdb.org/t/p/w300/still.jpg');
    expect(BBM.API.getStillURL(null)).toBeNull();
  });
  test('getProfileURL utilise Config.profileSize', () => {
    expect(BBM.API.getProfileURL('/p.jpg'))
      .toBe('https://image.tmdb.org/t/p/w185/p.jpg');
    expect(BBM.API.getProfileURL(null)).toBeNull();
  });
  test('getLogoURL — sélectionne un logo français en priorité', () => {
    const data = {
      images: {
        logos: [
          { iso_639_1: 'en', file_path: '/en.png' },
          { iso_639_1: 'fr', file_path: '/fr.png' }
        ]
      }
    };
    const url = BBM.API.getLogoURL(data, 'w500');
    expect(url).toContain('/fr.png');
  });
  test('getLogoURL fallback anglais si pas de FR', () => {
    const data = {
      images: { logos: [{ iso_639_1: 'en', file_path: '/en.png' }] }
    };
    expect(BBM.API.getLogoURL(data, 'w500')).toContain('/en.png');
  });
  test('getLogoURL null si aucune image', () => {
    expect(BBM.API.getLogoURL({}, 'w500')).toBeNull();
    expect(BBM.API.getLogoURL(null, 'w500')).toBeNull();
  });
});

describe('Timestamp helpers', () => {
  test('_msFromTimestamp — Firestore Timestamp avec toMillis', () => {
    const ts = { toMillis: () => 1700000000000 };
    expect(BBM.API._msFromTimestamp(ts)).toBe(1700000000000);
  });
  test('_msFromTimestamp — objet seconds (les nanoseconds sont ignorés)', () => {
    const ts = { seconds: 1700000000, nanoseconds: 500000000 };
    expect(BBM.API._msFromTimestamp(ts)).toBe(1700000000 * 1000);
  });
  test('_msFromTimestamp — number direct', () => {
    expect(BBM.API._msFromTimestamp(1700000000000)).toBe(1700000000000);
  });
  test('_msFromTimestamp — null/undefined', () => {
    expect(BBM.API._msFromTimestamp(null)).toBe(0);
    expect(BBM.API._msFromTimestamp(undefined)).toBe(0);
  });
});

describe('_normalizeStreamItem — cas avancés', () => {
  test('série : seriesTitle vide par défaut (sera enrichi via TMDB)', () => {
    const r = BBM.API._normalizeStreamItem({
      tmdbId: 1, type: 'series', url: 'x', season: 1, episode: 1
    });
    expect(r.seriesTitle).toBe('');
    expect(r.seasonNumber).toBe(1);
    expect(r.episodeNumber).toBe(1);
  });
  test('movie sans createdAt → createdAt null', () => {
    const r = BBM.API._normalizeStreamItem({
      tmdbId: 1, type: 'movie', url: 'x'
    });
    expect(r.createdAt).toBeNull();
  });
});

describe('_skipMarkersDocId — encore plus de cas', () => {
  test('tmdbID avec leading zero préservé', () => {
    expect(BBM.API._skipMarkersDocId('0042', 'movie')).toBe('0042');
  });
  test('saison 0 traitée comme valide', () => {
    expect(BBM.API._skipMarkersDocId('123', 'series', 0, 1)).toBe('123_s0_e1');
  });
  test('episode 0 traité comme valide', () => {
    expect(BBM.API._skipMarkersDocId('123', 'series', 1, 0)).toBe('123_s1_e0');
  });
});

describe('Sessions / progress helpers', () => {
  test('_sessionKey film (sans season/episode)', () => {
    expect(BBM.API._sessionKey('123', null, null)).toBe('123_0_0');
  });
  test('_sessionKey série', () => {
    expect(BBM.API._sessionKey('123', 2, 5)).toBe('123_2_5');
  });
});

describe('search helpers', () => {
  test('search() retourne [] sur catalogue vide', () => {
    expect(BBM.API.search('any')).toEqual([]);
  });
  test('search() avec query trop courte', () => {
    expect(BBM.API.search('a')).toEqual([]);
  });
});

describe('episodeRatingKey — divers', () => {
  test('format string vs number identique', () => {
    expect(BBM.API.episodeRatingKey('123', 1, 2))
      .toBe(BBM.API.episodeRatingKey(123, 1, 2));
  });
});

describe('cleanup / purge — guard rails', () => {
  test('endWatchParty avec code vide ne crash pas', async () => {
    await expect(BBM.API.endWatchParty()).resolves.toBeUndefined();
    await expect(BBM.API.endWatchParty(null)).resolves.toBeUndefined();
    await expect(BBM.API.endWatchParty('')).resolves.toBeUndefined();
  });
  test('leaveWatchParty avec args manquants ne crash pas', async () => {
    await expect(BBM.API.leaveWatchParty()).resolves.toBeUndefined();
    await expect(BBM.API.leaveWatchParty('CODE', null)).resolves.toBeUndefined();
    await expect(BBM.API.leaveWatchParty(null, 'uid')).resolves.toBeUndefined();
  });
  test('updateWatchPartyState avec code vide', async () => {
    await expect(BBM.API.updateWatchPartyState(null, {})).resolves.toBeUndefined();
  });
  test('startWatchParty avec code vide', async () => {
    await expect(BBM.API.startWatchParty()).resolves.toBeUndefined();
  });
  test('sendChatMessage avec code/text vide', async () => {
    await expect(BBM.API.sendChatMessage(null, 'hi')).resolves.toBeUndefined();
    await expect(BBM.API.sendChatMessage('CODE', '')).resolves.toBeUndefined();
    await expect(BBM.API.sendChatMessage('CODE', '   ')).resolves.toBeUndefined();
  });
  test('sendReaction avec args invalides', async () => {
    await expect(BBM.API.sendReaction(null, '❤️')).resolves.toBeUndefined();
    await expect(BBM.API.sendReaction('CODE', null)).resolves.toBeUndefined();
  });
  test('sendSystemMessage avec args invalides', async () => {
    await expect(BBM.API.sendSystemMessage(null, 'x')).resolves.toBeUndefined();
    await expect(BBM.API.sendSystemMessage('CODE', null)).resolves.toBeUndefined();
  });
});

describe('listenWatchParty / listenChatMessages / listenReactions — guards', () => {
  test('listenWatchParty(null) retourne un noop unsubscribe', () => {
    const off = BBM.API.listenWatchParty(null, () => {});
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
  });
  test('listenChatMessages(null)', () => {
    const off = BBM.API.listenChatMessages(null, () => {});
    expect(typeof off).toBe('function');
  });
  test('listenReactions(null)', () => {
    const off = BBM.API.listenReactions(null, () => {});
    expect(typeof off).toBe('function');
  });
});

describe('Rate limit interne', () => {
  test('_rateLimit existe avec timestamps initialisés à 0', () => {
    expect(BBM.API._rateLimit.lastChatAt).toBe(0);
    expect(BBM.API._rateLimit.lastReactionAt).toBe(0);
  });
});

describe('joinWatchParty — validation', () => {
  test('throw si code manquant', async () => {
    await expect(BBM.API.joinWatchParty()).rejects.toThrow('Code manquant');
    await expect(BBM.API.joinWatchParty('')).rejects.toThrow('Code manquant');
  });
});

describe('createWatchParty — validation', () => {
  test('throw si pas connecté', async () => {
    BBM.Auth.currentUser = null;
    await expect(BBM.API.createWatchParty({ tmdbID: 1 }))
      .rejects.toThrow('Connexion requise');
  });
});

describe('purgeStaleWatchParties — sans réseau', () => {
  test('retourne 0 sans crash si Firestore non dispo', async () => {
    const removed = await BBM.API.purgeStaleWatchParties();
    expect(removed).toBe(0);
  });
});

describe('cleanupOwnStaleWatchParties — sans réseau', () => {
  test('retourne 0 si pas connecté', async () => {
    BBM.Auth.currentUser = null;
    expect(await BBM.API.cleanupOwnStaleWatchParties()).toBe(0);
  });
});

describe('setUserAdmin — guards', () => {
  test('uid manquant — pas d\'op', async () => {
    await expect(BBM.API.setUserAdmin(null, true)).resolves.toBeUndefined();
    await expect(BBM.API.setUserAdmin('', true)).resolves.toBeUndefined();
  });
});

describe('getTMDBData — retry sur NetworkError', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    localStorage.clear();
    BBM.API._cache = {}; // reset cache
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  test('succès au 1er essai', async () => {
    let calls = 0;
    globalThis.fetch = () => {
      calls++;
      return Promise.resolve({ ok: true, json: async () => ({ title: 'OK', poster_path: '/x.jpg' }) });
    };
    const data = await BBM.API.getTMDBData('1', 'movie');
    expect(calls).toBe(1);
    expect(data.title).toBe('OK');
  });

  test('retry après NetworkError, succès au 2e essai', async () => {
    let calls = 0;
    globalThis.fetch = () => {
      calls++;
      if (calls === 1) return Promise.reject(new TypeError('NetworkError'));
      return Promise.resolve({ ok: true, json: async () => ({ title: 'recovered' }) });
    };
    const data = await BBM.API.getTMDBData('2', 'movie');
    expect(calls).toBe(2);
    expect(data.title).toBe('recovered');
  });

  test('null après 2 échecs (1 + retry)', async () => {
    let calls = 0;
    globalThis.fetch = () => { calls++; return Promise.reject(new TypeError('NetworkError')); };
    const data = await BBM.API.getTMDBData('3', 'movie');
    expect(calls).toBe(2);
    expect(data).toBeNull();
  });

  test('null si !res.ok (pas de retry sur 404/401)', async () => {
    let calls = 0;
    globalThis.fetch = () => {
      calls++;
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    };
    const data = await BBM.API.getTMDBData('4', 'movie');
    expect(calls).toBe(1);
    expect(data).toBeNull();
  });
});
