/**
 * Tests des fonctions PURES de BBM.API — celles qui ne touchent ni au
 * réseau ni à Firestore et qui produisent un output déterministe à
 * partir d'un input.
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { loadBBM } from './load-bbm.js';

let BBM;
beforeAll(() => { BBM = loadBBM(); });

describe('BBM.API.isHlsUrl', () => {
  test('détecte un manifest .m3u8', () => {
    expect(BBM.API.isHlsUrl('https://x/y.m3u8')).toBe(true);
    expect(BBM.API.isHlsUrl('https://x/y.m3u8?token=abc')).toBe(true);
  });
  test('rejette les autres URLs', () => {
    expect(BBM.API.isHlsUrl('https://x/y.mp4')).toBe(false);
    expect(BBM.API.isHlsUrl('')).toBe(false);
    expect(BBM.API.isHlsUrl(null)).toBe(false);
    expect(BBM.API.isHlsUrl(undefined)).toBe(false);
  });
});

describe('BBM.API._skipMarkersDocId', () => {
  test('films : juste tmdbID', () => {
    expect(BBM.API._skipMarkersDocId('123', 'movie')).toBe('123');
    expect(BBM.API._skipMarkersDocId(456, 'movie')).toBe('456');
  });
  test('séries : tmdbID + saison + épisode', () => {
    expect(BBM.API._skipMarkersDocId('123', 'series', 2, 5)).toBe('123_s2_e5');
    expect(BBM.API._skipMarkersDocId('999', 'series', 1, 1)).toBe('999_s1_e1');
  });
  test('série sans saison/épisode → fallback film', () => {
    expect(BBM.API._skipMarkersDocId('123', 'series')).toBe('123');
    expect(BBM.API._skipMarkersDocId('123', 'series', 1)).toBe('123');
    expect(BBM.API._skipMarkersDocId('123', 'series', null, 5)).toBe('123');
  });
});

describe('BBM.API.episodeRatingKey', () => {
  test('compose la clé tmdbID_sX_eY', () => {
    expect(BBM.API.episodeRatingKey('789', 1, 2)).toBe('789_s1_e2');
    expect(BBM.API.episodeRatingKey(789, 10, 15)).toBe('789_s10_e15');
  });
});

describe('BBM.API._normalizeStreamItem', () => {
  test('film : extrait les bons champs', () => {
    const r = BBM.API._normalizeStreamItem({
      tmdbId: 42, type: 'movie', url: 'https://x/y.mp4', addedAt: 1700000000000
    });
    expect(r.tmdbID).toBe('42');
    expect(r.category).toBe('movie');
    expect(r.url).toBe('https://x/y.mp4');
    expect(r.createdAt).toBeTruthy();
  });
  test('série : ajoute season/episode', () => {
    const r = BBM.API._normalizeStreamItem({
      tmdbId: 99, type: 'series', url: 'https://x/y.mp4',
      season: 2, episode: 4
    });
    expect(r.tmdbID).toBe('99');
    expect(r.category).toBe('series');
    expect(r.seasonNumber).toBe(2);
    expect(r.episodeNumber).toBe(4);
  });
  test('items invalides retournent null', () => {
    expect(BBM.API._normalizeStreamItem(null)).toBeNull();
    expect(BBM.API._normalizeStreamItem({})).toBeNull();
    expect(BBM.API._normalizeStreamItem({ tmdbId: 1 })).toBeNull();
    expect(BBM.API._normalizeStreamItem({ url: 'x' })).toBeNull();
  });
});

describe('BBM.API._generateRoomCode', () => {
  test('produit un code de 6 caractères', () => {
    for (let i = 0; i < 20; i++) {
      const code = BBM.API._generateRoomCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z2-9]+$/); // alphabet sans 0/O/I/1
    }
  });
  test('caractères ambigus exclus', () => {
    for (let i = 0; i < 100; i++) {
      const code = BBM.API._generateRoomCode();
      expect(code).not.toMatch(/[01OI]/);
    }
  });
});

describe('BBM.API.getPosterURL', () => {
  test('null/undefined → null', () => {
    expect(BBM.API.getPosterURL(null)).toBeNull();
    expect(BBM.API.getPosterURL(undefined)).toBeNull();
  });
  test('compose une URL TMDB valide', () => {
    expect(BBM.API.getPosterURL('/abc.jpg', 'w185'))
      .toBe('https://image.tmdb.org/t/p/w185/abc.jpg');
  });
  test('utilise la taille par défaut si non fournie', () => {
    expect(BBM.API.getPosterURL('/abc.jpg'))
      .toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
  });
});

describe('BBM.Notify (sans permission browser)', () => {
  test('hasPermission false en jsdom (pas de Notification API)', () => {
    expect(BBM.Notify.hasPermission()).toBe(false);
  });
  test('show ne crash pas même sans Notification API', () => {
    expect(() => BBM.Notify.show('Test', { body: 'hello' })).not.toThrow();
  });
});
