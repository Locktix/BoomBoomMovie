/**
 * Tests du module BBM.MiniPlayer — sauvegarde et reprise d'état dans
 * sessionStorage + rendu du widget flottant.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { resetBBM, setupStubs, loadFile } from './load-bbm.js';

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = '';
  resetBBM();
  setupStubs();
  // Charge api.js pour BBM.API.getPosterURL utilisé par render
  loadFile('js/api.js');
  // jsdom default location is "about:blank" so pathname doesn't end with
  // /watch.html — render() will skip the auto-render path which is what
  // we want when testing the API surface (saveState/getState/etc.)
  loadFile('js/mini-player.js');
});

describe('BBM.MiniPlayer.saveState', () => {
  test('persiste l\'état dans sessionStorage', () => {
    BBM.MiniPlayer.saveState({
      videoURL: 'https://x/y.mp4',
      title: 'Mon film',
      currentTime: 123,
      duration: 7200,
      tmdbID: '42',
      type: 'movie',
      season: null,
      episode: null,
      posterPath: '/poster.jpg'
    });
    const raw = sessionStorage.getItem('bbm_mini_player_state');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.videoURL).toBe('https://x/y.mp4');
    expect(parsed.title).toBe('Mon film');
    expect(parsed.currentTime).toBe(123);
    expect(parsed.tmdbID).toBe('42');
    expect(parsed.savedAt).toBeGreaterThan(0);
  });

  test('arrondit currentTime à l\'entier inférieur', () => {
    BBM.MiniPlayer.saveState({ videoURL: 'x', currentTime: 42.7 });
    const parsed = JSON.parse(sessionStorage.getItem('bbm_mini_player_state'));
    expect(parsed.currentTime).toBe(42);
  });

  test('skip si videoURL manquante', () => {
    BBM.MiniPlayer.saveState({ title: 'X', currentTime: 10 });
    expect(sessionStorage.getItem('bbm_mini_player_state')).toBeNull();
  });

  test('skip si state null', () => {
    BBM.MiniPlayer.saveState(null);
    expect(sessionStorage.getItem('bbm_mini_player_state')).toBeNull();
  });

  test('défauts pour les champs optionnels', () => {
    BBM.MiniPlayer.saveState({ videoURL: 'x' });
    const parsed = JSON.parse(sessionStorage.getItem('bbm_mini_player_state'));
    expect(parsed.title).toBe('');
    expect(parsed.currentTime).toBe(0);
    expect(parsed.duration).toBe(0);
    expect(parsed.type).toBe('movie');
    expect(parsed.season).toBeNull();
    expect(parsed.episode).toBeNull();
    expect(parsed.posterPath).toBeNull();
  });
});

describe('BBM.MiniPlayer.getState / clearState', () => {
  test('getState retourne null sans état', () => {
    expect(BBM.MiniPlayer.getState()).toBeNull();
  });

  test('getState retourne l\'état sauvegardé', () => {
    BBM.MiniPlayer.saveState({ videoURL: 'a', currentTime: 5 });
    const state = BBM.MiniPlayer.getState();
    expect(state.videoURL).toBe('a');
    expect(state.currentTime).toBe(5);
  });

  test('clearState supprime l\'état', () => {
    BBM.MiniPlayer.saveState({ videoURL: 'a', currentTime: 5 });
    BBM.MiniPlayer.clearState();
    expect(BBM.MiniPlayer.getState()).toBeNull();
  });

  test('getState fallback sur null si JSON invalide', () => {
    sessionStorage.setItem('bbm_mini_player_state', '{not valid');
    expect(BBM.MiniPlayer.getState()).toBeNull();
  });
});

describe('BBM.MiniPlayer.buildResumeURL', () => {
  test('film simple', () => {
    const url = BBM.MiniPlayer.buildResumeURL({
      videoURL: 'https://x/y.mp4',
      title: 'Mon film',
      tmdbID: '42',
      type: 'movie',
      currentTime: 60
    });
    expect(url).toContain('watch.html?');
    expect(url).toContain('v=https%3A%2F%2Fx%2Fy.mp4');
    expect(url).toContain('title=Mon+film');
    expect(url).toContain('tmdbid=42');
    expect(url).toContain('type=movie');
    expect(url).toContain('t=60');
    // Pas de saison/épisode (séparateur strict & devant)
    expect(url).not.toContain('&s=');
    expect(url).not.toContain('&e=');
  });

  test('série avec saison/épisode', () => {
    const url = BBM.MiniPlayer.buildResumeURL({
      videoURL: 'https://x/y.mp4',
      type: 'series',
      tmdbID: '99',
      season: 2,
      episode: 5,
      currentTime: 120
    });
    expect(url).toContain('s=2');
    expect(url).toContain('e=5');
    expect(url).toContain('type=series');
  });

  test('currentTime à 0 inclus', () => {
    const url = BBM.MiniPlayer.buildResumeURL({ videoURL: 'a' });
    expect(url).toContain('t=0');
  });
});

describe('BBM.MiniPlayer.isDismissed', () => {
  test('false par défaut', () => {
    const state = { videoURL: 'x', currentTime: 30 };
    expect(BBM.MiniPlayer.isDismissed(state)).toBe(false);
  });

  test('vrai si la signature matche le DISMISSED_KEY', () => {
    const state = { videoURL: 'x', currentTime: 30 };
    sessionStorage.setItem('bbm_mini_player_dismissed', BBM.MiniPlayer._stateSig(state));
    expect(BBM.MiniPlayer.isDismissed(state)).toBe(true);
  });

  test('faux pour un autre état', () => {
    sessionStorage.setItem('bbm_mini_player_dismissed', 'autre|0');
    const state = { videoURL: 'x', currentTime: 30 };
    expect(BBM.MiniPlayer.isDismissed(state)).toBe(false);
  });
});

describe('BBM.MiniPlayer._stateSig', () => {
  test('combine videoURL et currentTime', () => {
    expect(BBM.MiniPlayer._stateSig({ videoURL: 'a', currentTime: 10 })).toBe('a|10');
  });
  test('défauts', () => {
    expect(BBM.MiniPlayer._stateSig({})).toBe('|0');
  });
});

describe('BBM.MiniPlayer._escape', () => {
  test('échappe les caractères dangereux', () => {
    expect(BBM.MiniPlayer._escape('<script>')).toBe('&lt;script>');
    expect(BBM.MiniPlayer._escape('a & b')).toBe('a &amp; b');
    expect(BBM.MiniPlayer._escape('"x"')).toBe('&quot;x&quot;');
  });
});

describe('BBM.MiniPlayer.render()', () => {
  test('ne fait rien sans état sauvegardé', () => {
    BBM.MiniPlayer.render();
    expect(document.getElementById('mini-player')).toBeNull();
  });

  test('crée le widget si état présent', () => {
    BBM.MiniPlayer.saveState({
      videoURL: 'https://x/y.mp4',
      title: 'Mon film',
      currentTime: 60,
      duration: 7200,
      tmdbID: '42',
      type: 'movie',
      posterPath: '/poster.jpg'
    });
    BBM.MiniPlayer.render();
    const widget = document.getElementById('mini-player');
    expect(widget).toBeTruthy();
    expect(widget.querySelector('.mini-player-title').textContent).toBe('Mon film');
  });

  test('affiche S01E03 pour les séries', () => {
    BBM.MiniPlayer.saveState({
      videoURL: 'x',
      title: 'Stranger Things',
      currentTime: 60,
      duration: 3600,
      type: 'series',
      season: 1,
      episode: 3
    });
    BBM.MiniPlayer.render();
    const ep = document.querySelector('.mini-player-ep');
    expect(ep).toBeTruthy();
    expect(ep.textContent).toBe('S01E03');
  });

  test('barre de progression reflète le ratio', () => {
    BBM.MiniPlayer.saveState({
      videoURL: 'x', title: 'Y',
      currentTime: 1800, duration: 3600
    });
    BBM.MiniPlayer.render();
    const fill = document.querySelector('.mini-player-progress-fill');
    expect(fill.style.width).toMatch(/^50/);
  });

  test('bouton fermer dismiss + retire le widget', () => {
    BBM.MiniPlayer.saveState({ videoURL: 'x', title: 'Y', currentTime: 60 });
    BBM.MiniPlayer.render();
    const widget = document.getElementById('mini-player');
    const closeBtn = widget.querySelector('.mini-player-close');
    closeBtn.click();
    // Le widget se cache (transition fade) puis est retiré au bout de 250ms
    expect(widget.classList.contains('visible')).toBe(false);
  });

  test('idempotent — second render ne crée pas de doublon', () => {
    BBM.MiniPlayer.saveState({ videoURL: 'x', title: 'Y', currentTime: 60 });
    BBM.MiniPlayer.render();
    BBM.MiniPlayer.render();
    expect(document.querySelectorAll('#mini-player').length).toBe(1);
  });

  test('isDismissed → pas de widget', () => {
    const state = { videoURL: 'x', title: 'Y', currentTime: 60 };
    BBM.MiniPlayer.saveState(state);
    sessionStorage.setItem('bbm_mini_player_dismissed', BBM.MiniPlayer._stateSig(state));
    BBM.MiniPlayer.render();
    expect(document.getElementById('mini-player')).toBeNull();
  });
});
