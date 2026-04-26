/**
 * Tests du module BBM.Settings — gestion des préférences localStorage
 * et application au DOM.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { resetBBM, setupStubs, loadFile } from './load-bbm.js';

beforeEach(() => {
  // Reset du localStorage entre les tests
  localStorage.clear();
  // Reset du DOM
  document.body.className = '';
  document.documentElement.style.cssText = '';
  resetBBM();
  setupStubs();
  loadFile('js/settings.js');
});

describe('BBM.Settings — DEFAULTS', () => {
  test('expose les defaults attendus', () => {
    const d = BBM.Settings.DEFAULTS;
    expect(d['playback.autoplayNext']).toBe(true);
    expect(d['playback.autoplayCountdown']).toBe(10);
    expect(d['playback.skipIntro']).toBe(false);
    expect(d['playback.defaultSpeed']).toBe(1);
    expect(d['playback.defaultVolume']).toBe(100);
    expect(d['appearance.accent']).toBe('violet');
    expect(d['appearance.density']).toBe('normal');
    expect(d['appearance.highContrast']).toBe(false);
    expect(d['performance.potatoMode']).toBe(false);
    expect(d['notifications.requestApproved']).toBe(true);
    expect(d['notifications.newContent']).toBe(true);
    expect(d['notifications.browserPush']).toBe(false);
    expect(d['privacy.saveProgress']).toBe(true);
    expect(d['privacy.saveHistory']).toBe(true);
  });

  test('DEFAULTS est gelé', () => {
    expect(Object.isFrozen(BBM.Settings.DEFAULTS)).toBe(true);
  });
});

describe('BBM.Settings — ACCENT_PALETTES', () => {
  test('contient les 7 couleurs prévues', () => {
    const p = BBM.Settings.ACCENT_PALETTES;
    expect(p.violet).toBeDefined();
    expect(p.red).toBeDefined();
    expect(p.amber).toBeDefined();
    expect(p.emerald).toBeDefined();
    expect(p.pink).toBeDefined();
    expect(p.blue).toBeDefined();
    expect(p.cyan).toBeDefined();
  });
  test('chaque palette a rgb, deep, hover, label', () => {
    Object.values(BBM.Settings.ACCENT_PALETTES).forEach(palette => {
      expect(palette.rgb).toMatch(/^\d+, \d+, \d+$/);
      expect(palette.deep).toMatch(/^\d+, \d+, \d+$/);
      expect(palette.hover).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(typeof palette.label).toBe('string');
    });
  });
});

describe('BBM.Settings — get/set', () => {
  test('get retourne la valeur par défaut au démarrage', () => {
    expect(BBM.Settings.get('playback.skipIntro')).toBe(false);
    expect(BBM.Settings.get('appearance.accent')).toBe('violet');
  });

  test('set persiste la nouvelle valeur', () => {
    BBM.Settings.set('appearance.accent', 'red');
    expect(BBM.Settings.get('appearance.accent')).toBe('red');
  });

  test('set est idempotent — pas de notification si valeur identique', () => {
    let count = 0;
    BBM.Settings.onChange(() => { count++; });
    BBM.Settings.set('appearance.accent', 'red');
    BBM.Settings.set('appearance.accent', 'red'); // identique
    expect(count).toBe(1);
  });

  test('reset restaure les defaults', () => {
    BBM.Settings.set('appearance.accent', 'cyan');
    BBM.Settings.set('playback.skipIntro', true);
    BBM.Settings.reset();
    expect(BBM.Settings.get('appearance.accent')).toBe('violet');
    expect(BBM.Settings.get('playback.skipIntro')).toBe(false);
  });

  test('all() retourne une copie de l\'état', () => {
    const a = BBM.Settings.all();
    a['appearance.accent'] = 'tampered';
    expect(BBM.Settings.get('appearance.accent')).toBe('violet');
  });
});

describe('BBM.Settings — listeners', () => {
  test('onChange notifie sur set', () => {
    let lastKey, lastValue;
    BBM.Settings.onChange((k, v) => { lastKey = k; lastValue = v; });
    BBM.Settings.set('playback.skipIntro', true);
    expect(lastKey).toBe('playback.skipIntro');
    expect(lastValue).toBe(true);
  });

  test('onChange retourne une fonction de désinscription', () => {
    let count = 0;
    const off = BBM.Settings.onChange(() => { count++; });
    BBM.Settings.set('playback.skipIntro', true);
    off();
    BBM.Settings.set('playback.skipIntro', false);
    expect(count).toBe(1);
  });

  test('un listener qui throw ne casse pas les autres', () => {
    let secondCalled = false;
    BBM.Settings.onChange(() => { throw new Error('boom'); });
    BBM.Settings.onChange(() => { secondCalled = true; });
    BBM.Settings.set('playback.skipIntro', true);
    expect(secondCalled).toBe(true);
  });
});

describe('BBM.Settings — apply au DOM', () => {
  test('apply applique la classe density', () => {
    BBM.Settings.set('appearance.density', 'compact');
    expect(document.body.classList.contains('bbm-density-compact')).toBe(true);
  });

  test('apply switch entre densities', () => {
    BBM.Settings.set('appearance.density', 'spacious');
    expect(document.body.classList.contains('bbm-density-spacious')).toBe(true);
    BBM.Settings.set('appearance.density', 'normal');
    expect(document.body.classList.contains('bbm-density-spacious')).toBe(false);
    expect(document.body.classList.contains('bbm-density-normal')).toBe(true);
  });

  test('high contrast toggle', () => {
    BBM.Settings.set('appearance.highContrast', true);
    expect(document.body.classList.contains('bbm-high-contrast')).toBe(true);
    BBM.Settings.set('appearance.highContrast', false);
    expect(document.body.classList.contains('bbm-high-contrast')).toBe(false);
  });

  test('potato mode toggle', () => {
    BBM.Settings.set('performance.potatoMode', true);
    expect(document.body.classList.contains('bbm-potato')).toBe(true);
  });

  test('items per row pose une CSS var', () => {
    BBM.Settings.set('home.itemsPerRow', 8);
    expect(document.documentElement.style.getPropertyValue('--bbm-items-per-row')).toBe('8');
  });
});

describe('BBM.Settings — posterSize()', () => {
  test('low → w185', () => {
    BBM.Settings.set('performance.posterQuality', 'low');
    expect(BBM.Settings.posterSize()).toBe('w185');
  });
  test('high → w780', () => {
    BBM.Settings.set('performance.posterQuality', 'high');
    expect(BBM.Settings.posterSize()).toBe('w780');
  });
  test('default → w500', () => {
    expect(BBM.Settings.posterSize()).toBe('w500');
  });
});

describe('BBM.Settings — persistance localStorage', () => {
  test('set écrit en localStorage', () => {
    BBM.Settings.set('appearance.accent', 'cyan');
    const raw = localStorage.getItem('bbm_settings_v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed['appearance.accent']).toBe('cyan');
  });

  test('reload lit depuis localStorage', () => {
    BBM.Settings.set('appearance.accent', 'amber');
    // Simule un reload
    resetBBM();
    setupStubs();
    loadFile('js/settings.js');
    expect(BBM.Settings.get('appearance.accent')).toBe('amber');
  });

  test('localStorage corrompu — fallback sur defaults', () => {
    localStorage.setItem('bbm_settings_v1', '{not_json');
    resetBBM();
    setupStubs();
    loadFile('js/settings.js');
    expect(BBM.Settings.get('appearance.accent')).toBe('violet');
  });
});
